package com.bobbuy.security;

import jakarta.servlet.http.HttpServletRequest;
import java.net.InetAddress;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Uses forwarding headers only when the direct peer is in an explicitly trusted CIDR. */
@Component
public class TrustedClientIpResolver {
    private final List<Cidr> trusted;
    public TrustedClientIpResolver(@Value("${bobbuy.auth-abuse.trusted-proxies:}") String configured){
        trusted=new ArrayList<>(); for(String value:configured.split(","))if(!value.isBlank())trusted.add(Cidr.parse(value.trim()));
    }
    public String resolve(HttpServletRequest request){
        String peer=canonical(request.getRemoteAddr());
        if(!isTrusted(peer))return peer;
        String forwarded=request.getHeader("X-Forwarded-For");
        if(forwarded==null||forwarded.isBlank())return peer;
        String[] chain=forwarded.split(",");
        for(int i=chain.length-1;i>=0;i--){String candidate=canonical(chain[i].trim());if(!isTrusted(candidate))return candidate;}
        return canonical(chain[0].trim());
    }
    private boolean isTrusted(String address){try{InetAddress ip=InetAddress.getByName(address);return trusted.stream().anyMatch(c->c.contains(ip));}catch(Exception ignored){return false;}}
    private static String canonical(String value){try{return InetAddress.getByName(value).getHostAddress();}catch(Exception ignored){return "unknown";}}
    private record Cidr(byte[] network,int bits){
        static Cidr parse(String value){try{String[] p=value.split("/",2);byte[] ip=InetAddress.getByName(p[0]).getAddress();int bits=p.length==2?Integer.parseInt(p[1]):ip.length*8;if(bits<0||bits>ip.length*8)throw new IllegalArgumentException("Invalid trusted proxy CIDR");return new Cidr(ip,bits);}catch(Exception e){throw new IllegalArgumentException("Invalid trusted proxy CIDR",e);}}
        boolean contains(InetAddress value){byte[] ip=value.getAddress();if(ip.length!=network.length)return false;for(int i=0;i<bits;i++)if(((ip[i/8]^network[i/8])&(0x80>>(i%8)))!=0)return false;return true;}
    }
}
