console.log("[*] Frida Gadget loaded — SSL Pinning Bypass active");

// === 1. OkHttp SSL Pinning Bypass (если используется) ===
try {
    const CertificatePinner = Java.use('okhttp3.CertificatePinner');
    CertificatePinner.check.overload('java.lang.String', 'java.util.List').implementation = function() {
        console.log("[+] SSL Pinning bypassed via OkHttp");
        return;
    };
} catch (e) {
    console.log("[-] OkHttp pinning hook failed:", e.message);
}

// === 2. TrustManager Bypass ===
try {
    const X509TrustManager = Java.use('javax.net.ssl.X509TrustManager');
    const SSLContext = Java.use('javax.net.ssl.SSLContext');

    // Создаём заглушку для TrustManager
    const TrustAllCerts = Java.extend(X509TrustManager, {
        checkClientTrusted: function(chain, authType) {},
        checkServerTrusted: function(chain, authType) {},
        getAcceptedIssuers: function() { return []; }
    });

    // Перехватываем создание SSLContext
    const init = SSLContext.prototype.init;
    SSLContext.prototype.init.implementation = function(keyManagers, trustManagers, secureRandom) {
        console.log("[+] SSLContext initialized with custom TrustManager");
        return init.call(this, keyManagers, [new TrustAllCerts()], secureRandom);
    };

    console.log("[+] TrustManager bypass active");
} catch (e) {
    console.log("[-] TrustManager bypass failed:", e.message);
}

// === 3. Сетевой перехват (после обхода) ===
setTimeout(() => {
    try {
        const URLConnection = Java.use('java.net.URLConnection');
        URLConnection.setRequestProperty.overload('java.lang.String', 'java.lang.String').implementation = function(key, value) {
            if (key.toLowerCase().includes('auth') || key.toLowerCase().includes('token') || key.toLowerCase().includes('handshake')) {
                console.log('[+] AUTH HEADER:', key, '=', value);
            }
            return this.setRequestProperty(key, value);
        };
        console.log("[+] Network header hook active");
    } catch (e) {
        console.log("[-] Header hook failed:", e.message);
    }
}, 1000);

// === 4. Дополнительно: логирование всех HTTP запросов ===
try {
    const OkHttpClient = Java.use('okhttp3.OkHttpClient');
    const RequestBuilder = Java.use('okhttp3.Request$Builder');

    RequestBuilder.build.implementation = function() {
        const request = this.build();
        const url = request.url().toString();
        const headers = request.headers();

        console.log("[*] Request to:", url);
        for (let i = 0; i < headers.size(); i++) {
            const name = headers.name(i);
            const value = headers.value(i);
            if (name.toLowerCase().includes('auth') || 
                name.toLowerCase().includes('token') || 
                name.toLowerCase().includes('handshake')) {
                console.log('[+] HEADER:', name, '=', value);
            }
        }

        return request;
    };
    console.log("[+] OkHttp request logger active");
} catch (e) {
    console.log("[-] OkHttp logger failed:", e.message);
}