"""
Obtención (una sola vez) del REFRESH TOKEN de Gmail API para el envío de RIDE.

Render bloquea el SMTP saliente, por lo que el envío de correos usa la Gmail API
(HTTPS). Esa API requiere OAuth2: este script realiza el flujo de consentimiento
en tu navegador y te imprime el refresh_token que luego pegas en
Admin → Config. SRI → sección Gmail.

USO (en tu PC, NO en Render):
    1. En Google Cloud Console crea un proyecto, habilita "Gmail API", configura la
       pantalla de consentimiento OAuth (tipo Externo, agrega tu cuenta Gmail como
       usuario de prueba, scope https://www.googleapis.com/auth/gmail.send) y crea
       una credencial "ID de cliente OAuth" tipo "Aplicación de escritorio".
       Eso te da un Client ID y un Client Secret.
    2. Ejecuta:   python gmail_oauth_setup.py
    3. Pega Client ID y Client Secret cuando se te pidan.
    4. Se abrirá el navegador → inicia sesión con la cuenta remitente → "Permitir".
    5. El script imprime el REFRESH TOKEN. Cópialo a la configuración.

Solo usa la librería estándar de Python (no requiere pip install).
"""
import http.server
import json
import socketserver
import urllib.parse
import urllib.request
import webbrowser

SCOPE = "https://www.googleapis.com/auth/gmail.send"
AUTH_URI = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URI = "https://oauth2.googleapis.com/token"
PORT = 8765
REDIRECT_URI = f"http://localhost:{PORT}/"

_codigo = {"value": None}


class _Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        _codigo["value"] = params.get("code", [None])[0]
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        msg = ("Autorización recibida. Ya puedes cerrar esta pestaña y volver a la terminal."
               if _codigo["value"] else "No se recibió el código de autorización.")
        self.wfile.write(f"<html><body style='font-family:sans-serif'><h2>{msg}</h2></body></html>".encode("utf-8"))

    def log_message(self, *args):
        pass  # silenciar logs del servidor


def main():
    client_id = input("Client ID: ").strip()
    client_secret = input("Client Secret: ").strip()
    if not client_id or not client_secret:
        print("Client ID y Client Secret son obligatorios.")
        return

    auth_url = AUTH_URI + "?" + urllib.parse.urlencode({
        "client_id": client_id,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": SCOPE,
        "access_type": "offline",
        "prompt": "consent",  # fuerza la emisión de un refresh_token
    })
    print("\nAbriendo el navegador para autorizar...")
    print("Si no se abre, pega esta URL manualmente:\n" + auth_url + "\n")
    webbrowser.open(auth_url)

    with socketserver.TCPServer(("localhost", PORT), _Handler) as httpd:
        httpd.handle_request()  # atiende una sola petición (el redirect con el code)

    code = _codigo["value"]
    if not code:
        print("No se obtuvo el código de autorización. Reintenta.")
        return

    data = urllib.parse.urlencode({
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": REDIRECT_URI,
        "grant_type": "authorization_code",
    }).encode("utf-8")
    req = urllib.request.Request(TOKEN_URI, data=data)
    with urllib.request.urlopen(req) as resp:
        tokens = json.loads(resp.read().decode("utf-8"))

    refresh_token = tokens.get("refresh_token")
    if not refresh_token:
        print("\nNo se recibió refresh_token. Respuesta:")
        print(json.dumps(tokens, indent=2))
        print("\nConsejo: revoca el acceso previo en https://myaccount.google.com/permissions y reintenta (el prompt=consent ya está forzado).")
        return

    print("\n" + "=" * 60)
    print("REFRESH TOKEN (cópialo a Admin → Config. SRI → Gmail):")
    print(refresh_token)
    print("=" * 60)
    print("\nGuarda también el Client ID y Client Secret en esa misma sección.")


if __name__ == "__main__":
    main()
