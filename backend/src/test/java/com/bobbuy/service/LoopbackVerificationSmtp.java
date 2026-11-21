package com.bobbuy.service;

import com.bobbuy.model.MailSettings;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;

/** A single local SMTP exchange. No production address, TLS setting or credential is used. */
public final class LoopbackVerificationSmtp implements AutoCloseable {
    private final ServerSocket server;
    private final CompletableFuture<String> body = new CompletableFuture<>();
    private final Thread worker;

    public LoopbackVerificationSmtp(int delayMs, String dataReply) throws IOException {
        server = new ServerSocket(0, 1, InetAddress.getLoopbackAddress());
        worker = new Thread(() -> exchange(delayMs, dataReply), "verification-smtp-fixture");
        worker.setDaemon(true);
        worker.start();
    }

    public void send(SimpleMailMessage message, int timeoutMs) {
        MailSettings local = new MailSettings();
        local.host = server.getInetAddress().getHostAddress();
        local.port = server.getLocalPort();
        new SmtpDelivery(timeoutMs) {
            @Override JavaMailSenderImpl createSender(MailSettings settings, String password) {
                var sender = super.createSender(settings, password);
                var properties = sender.getJavaMailProperties();
                properties.setProperty("mail.smtp.starttls.enable", "false");
                properties.setProperty("mail.smtp.starttls.required", "false");
                properties.setProperty("mail.smtp.auth", "false");
                return sender;
            }
        }.send(local, null, message);
    }

    public String receivedCode() throws Exception {
        var code = Pattern.compile("(?<![0-9])[0-9]{6}(?![0-9])").matcher(body.get(3, TimeUnit.SECONDS));
        if (!code.find()) throw new IllegalStateException("Synthetic SMTP DATA did not include a verification code");
        return code.group();
    }

    private void exchange(int delayMs, String dataReply) {
        try (var socket = server.accept();
             var in = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.US_ASCII));
             var out = new PrintWriter(new OutputStreamWriter(socket.getOutputStream(), StandardCharsets.US_ASCII), true)) {
            socket.setSoTimeout(10000);
            reply(out, "220 loopback ESMTP");
            String line;
            while ((line = in.readLine()) != null) {
                String command = line.toUpperCase(Locale.ROOT);
                if (command.equals("DATA")) {
                    reply(out, "354 End data with <CRLF>.<CRLF>");
                    StringBuilder contents = new StringBuilder();
                    while ((line = in.readLine()) != null && !line.equals(".")) contents.append(line).append('\n');
                    if (line == null) throw new IOException("Synthetic SMTP client closed before DATA terminator");
                    int bodyStart = contents.indexOf("\n\n");
                    if (bodyStart < 0) throw new IOException("Synthetic SMTP message has no body");
                    if (!body.complete(contents.substring(bodyStart + 2))) {
                        throw new IOException("Unexpected second DATA submission");
                    }
                    Thread.sleep(delayMs);
                    reply(out, dataReply);
                } else if (command.equals("QUIT")) {
                    reply(out, "221 Bye");
                    return;
                } else {
                    reply(out, "250 OK");
                }
            }
        } catch (IOException | InterruptedException failure) {
            body.completeExceptionally(failure);
        }
    }

    private static void reply(PrintWriter out, String text) {
        out.print(text + "\r\n");
        out.flush();
    }

    @Override public void close() throws Exception {
        server.close();
        worker.join(3000);
        if (worker.isAlive()) throw new IllegalStateException("Synthetic SMTP worker did not finish");
    }
}
