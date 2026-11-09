package com.bobbuy.service;

import java.io.ByteArrayOutputStream;
import java.io.EOFException;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.Proxy;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import javax.net.ssl.SNIHostName;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.SSLContext;

/** One public HTTPS GET over an already validated IP. No proxy, redirect, cookies, auth or DNS lookup.
 * The original hostname remains the TLS peer/SNI and HTTPS certificate identity.
 */
public final class CostcoPublicHttpsTransport implements CostcoPublicEvidenceFetcher.Transport {
    @Override public CostcoPublicEvidenceFetcher.Response get(URI uri,InetAddress pinnedAddress,int maxBytes,Duration timeout) throws IOException {
        CostcoOfficialEvidence.validateHttps(uri);
        if(!CostcoPublicEvidenceFetcher.isPublicAddress(pinnedAddress)||maxBytes<1||maxBytes>CostcoPublicEvidenceFetcher.MAX_IMAGE_BYTES||timeout.isNegative()||timeout.isZero())
            throw new IOException("Invalid retrieval limits");
        long deadline=System.nanoTime()+Math.min(timeout.toNanos(),Duration.ofSeconds(15).toNanos());
        var ascii=URI.create(uri.toASCIIString());String host=ascii.getHost();String target=ascii.getRawPath();if(target==null||target.isEmpty())target="/";
        if(ascii.getRawQuery()!=null)target+="?"+ascii.getRawQuery();
        if(target.length()>2048||target.indexOf('\r')>=0||target.indexOf('\n')>=0)throw new IOException("Invalid request target");
        try(var raw=new Socket(Proxy.NO_PROXY)) {
            // InetSocketAddress(InetAddress,port) cannot re-resolve the peer hostname.
            raw.connect(new InetSocketAddress(pinnedAddress,443),remainingMillis(deadline));
            raw.setSoTimeout(remainingMillis(deadline));
            SSLSocketFactory factory;
            try { var context=SSLContext.getInstance("TLS");context.init(null,null,null);factory=context.getSocketFactory(); }
            catch(java.security.GeneralSecurityException failure){throw new IOException("TLS initialization failed",failure);}
            try(var tls=(SSLSocket)factory.createSocket(raw,host,443,true)) {
                var parameters=tls.getSSLParameters();parameters.setEndpointIdentificationAlgorithm("HTTPS");
                if(!host.contains(":")&&!host.matches("[0-9.]+"))parameters.setServerNames(List.of(new SNIHostName(host)));
                tls.setSSLParameters(parameters);tls.setSoTimeout(remainingMillis(deadline));tls.startHandshake();
                String hostHeader=host.contains(":")&&!host.startsWith("[")?"["+host+"]":host;
                String request="GET "+target+" HTTP/1.1\r\nHost: "+hostHeader+"\r\nUser-Agent: Bobuy-Evidence/1.0\r\nAccept: text/html,application/json,image/png,image/jpeg;q=0.9\r\nAccept-Encoding: identity\r\nConnection: close\r\n\r\n";
                tls.getOutputStream().write(request.getBytes(StandardCharsets.US_ASCII));tls.getOutputStream().flush();
                try(var in=new TimedInput(tls.getInputStream(),tls,deadline)){return readResponse(in,maxBytes);}
            }
        }
    }
    /** Package-visible for protocol regression tests; no socket or external endpoint needed. */
    static CostcoPublicEvidenceFetcher.Response readResponse(InputStream in,int maxBytes) throws IOException {
        String statusLine=line(in,8192);if(!statusLine.matches("HTTP/1\\.[01] [0-9]{3}(?: .*)?"))throw new IOException("Invalid HTTP status");
        int status=Integer.parseInt(statusLine.substring(9,12));var headers=new LinkedHashMap<String,List<String>>();int headerBytes=statusLine.length();
        for(int count=0;;count++) {
            String text=line(in,8192);headerBytes+=text.length()+2;if(headerBytes>32768||count>100)throw new IOException("Headers too large");
            if(text.isEmpty())break;
            int colon=text.indexOf(':');if(colon<1||text.charAt(0)==' '||text.charAt(0)=='\t')throw new IOException("Invalid header");
            String name=text.substring(0,colon).toLowerCase(Locale.ROOT),value=text.substring(colon+1).strip();
            if(!name.matches("[!#$%&'*+.^_`|~0-9a-z-]+"))throw new IOException("Invalid header name");
            headers.computeIfAbsent(name,key->new ArrayList<>()).add(value);
        }
        String length=single(headers,"content-length"),encoding=single(headers,"transfer-encoding");
        if(length!=null&&encoding!=null)throw new IOException("Ambiguous body framing");
        // Redirect/error bodies are never evidence and are not followed or consumed here.
        if(status!=200)return new CostcoPublicEvidenceFetcher.Response(status,headers,new byte[0]);
        if(single(headers,"content-encoding")!=null&&!"identity".equalsIgnoreCase(single(headers,"content-encoding")))throw new IOException("Compressed evidence is unsupported");
        var bytes=new ByteArrayOutputStream(Math.min(maxBytes,32768));
        if(encoding!=null) {
            if(!"chunked".equalsIgnoreCase(encoding))throw new IOException("Unsupported transfer encoding");
            while(true) {
                String chunk=line(in,1024).split(";",2)[0];if(!chunk.matches("[0-9a-fA-F]{1,8}"))throw new IOException("Invalid chunk");
                long size=Long.parseLong(chunk,16);if(size>maxBytes-bytes.size())throw new IOException("Evidence exceeds size limit");
                if(size==0)break;
                copyExactly(in,bytes,(int)size);if(!line(in,2).isEmpty())throw new IOException("Invalid chunk boundary");
            }
        }else if(length!=null) {
            if(!length.matches("[0-9]{1,10}"))throw new IOException("Invalid content length");
            long size=Long.parseLong(length);if(size>maxBytes)throw new IOException("Evidence exceeds size limit");copyExactly(in,bytes,(int)size);
        }else {
            byte[] buffer=new byte[8192];int read;
            while((read=in.read(buffer,0,Math.min(buffer.length,maxBytes-bytes.size()+1)))!=-1){
                if(read>maxBytes-bytes.size())throw new IOException("Evidence exceeds size limit");bytes.write(buffer,0,read);
            }
        }
        return new CostcoPublicEvidenceFetcher.Response(status,headers,bytes.toByteArray());
    }
    private static String single(LinkedHashMap<String,List<String>> headers,String name) throws IOException {
        var values=headers.get(name);if(values==null)return null;if(values.size()!=1)throw new IOException("Duplicate framing/header "+name);return values.get(0);
    }
    private static void copyExactly(InputStream in,ByteArrayOutputStream out,int size) throws IOException {
        byte[] buffer=new byte[Math.min(8192,Math.max(size,1))];int remaining=size;
        while(remaining>0){int n=in.read(buffer,0,Math.min(buffer.length,remaining));if(n<0)throw new EOFException("Truncated response");out.write(buffer,0,n);remaining-=n;}
    }
    private static String line(InputStream in,int max) throws IOException {
        var out=new ByteArrayOutputStream();boolean cr=false;
        while(true){int b=in.read();if(b<0)throw new EOFException("Truncated header");if(cr){if(b!='\n')throw new IOException("Invalid line ending");return out.toString(StandardCharsets.US_ASCII);}if(b=='\r'){cr=true;continue;}if(b=='\n'||b==0||b>127||out.size()>=max)throw new IOException("Invalid/large header line");out.write(b);}
    }
    private static int remainingMillis(long deadline) throws IOException {
        long remaining=deadline-System.nanoTime();if(remaining<=0)throw new IOException("Retrieval deadline exceeded");return(int)Math.max(1,Math.min(5000,Duration.ofNanos(remaining).toMillis()));
    }
    private static final class TimedInput extends FilterInputStream {
        private final Socket socket;private final long deadline;
        TimedInput(InputStream in,Socket socket,long deadline){super(in);this.socket=socket;this.deadline=deadline;}
        @Override public int read() throws IOException {socket.setSoTimeout(remainingMillis(deadline));return in.read();}
        @Override public int read(byte[] bytes,int off,int len)throws IOException{socket.setSoTimeout(remainingMillis(deadline));return in.read(bytes,off,len);}
    }
}
