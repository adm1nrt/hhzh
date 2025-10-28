console.log("[*] Standoff 2 — TLS Key Logger & Plaintext Interceptor");

// === 1. Поиск SSL_write в Firebase и Unity ===
const libs = ["libFirebaseCppApp-12_2_1.so", "libunity.so", "libmain.so"];

let hooked = false;
for (let lib of libs) {
    try {
        const sslWrite = Module.findExportByName(lib, "SSL_write");
        if (sslWrite) {
            console.log("[+] Found SSL_write in", lib);
            Interceptor.attach(sslWrite, {
                onEnter: function(args) {
                    this.buf = args[1];
                    this.len = args[2].toInt32();
                },
                onLeave: function(retval) {
                    if (this.len > 10 && this.len < 2000) {
                        try {
                            const data = this.buf.readUtf8String(this.len);
                            if (data.includes("handshake") || data.includes("token") || data.includes("{")) {
                                console.log("[+] PLAINTEXT SEND (" + lib + "):", data);
                            }
                        } catch (e) {}
                    }
                }
            });
            hooked = true;
            break;
        }
    } catch (e) {}
}

if (!hooked) {
    console.log("[-] SSL_write not found in known libraries");
}

// === 2. Альтернатива: хук на send() ===
try {
    const sendPtr = Module.findExportByName("libc.so", "send");
    if (sendPtr) {
        Interceptor.attach(sendPtr, {
            onEnter: function(args) {
                this.buf = args[1];
                this.len = args[2].toInt32();
            },
            onLeave: function(retval) {
                if (this.len > 10 && this.len < 2000) {
                    try {
                        const data = this.buf.readUtf8String(this.len);
                        if (data.includes("handshake")) {
                            console.log("[+] SEND DATA (libc):", data);
                        }
                    } catch (e) {}
                }
            }
        });
        console.log("[+] Hooked libc send()");
    }
} catch (e) {
    console.log("[-] Failed to hook send()");
}

// === 3. Обход SSL Pinning (на всякий случай) ===
try {
    const X509_verify_cert = Module.findExportByName("libcrypto.so", "X509_verify_cert");
    if (X509_verify_cert) {
        Interceptor.replace(X509_verify_cert, new NativeCallback(() => 1, 'int', []));
        console.log("[+] X509_verify_cert bypassed");
    }
} catch (e) {}

console.log("[*] Hooks installed. Perform login now.");
