"""
sri_facturacion.py
Módulo de facturación electrónica SRI Ecuador para Family Health.

Flujo:
1. Generar XML de factura (formato SRI versión 2.1.0)
2. Firmar XML con certificado .p12 (XMLDSig - RSA-SHA1)
3. Enviar al webservice del SRI (WSDL)
4. Recibir clave de acceso y autorización
5. Generar RIDE (PDF oficial)

Webservices SRI:
- Pruebas: https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl
- Producción: https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl

Refs: https://www.sri.gob.ec/comprobantes-electronicos
"""

import hashlib
import base64
import uuid
import re
from datetime import datetime, timezone
from typing import Optional
from io import BytesIO

# XML generation
from lxml import etree

# Cryptography for .p12 handling
from cryptography.hazmat.primitives.serialization import pkcs12, Encoding, PublicFormat
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.backends import default_backend
from cryptography.x509 import load_der_x509_certificate
import binascii


# ─── Entornos SRI ────────────────────────────────────────────────────────────
SRI_AMBIENTES = {
    "pruebas": {
        "recepcion": "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline",
        "autorizacion": "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline",
        "codigo": "1",
    },
    "produccion": {
        "recepcion": "https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline",
        "autorizacion": "https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline",
        "codigo": "2",
    },
}


# ─── Generar clave de acceso (49 dígitos) ────────────────────────────────────
def generar_clave_acceso(
    fecha: str,          # DD/MM/YYYY
    tipo_comprobante: str,  # 01=factura
    ruc: str,
    ambiente: str,       # 1=pruebas 2=produccion
    serie: str,          # 001001
    numero: str,         # 000000001
    tipo_emision: str = "1",  # 1=normal
) -> str:
    """
    Clave de acceso de 49 dígitos según especificación SRI.
    Formato: fechaEmision(8) + tipoComprobante(2) + ruc(13) +
             tipoAmbiente(1) + serie(6) + numeroComprobante(9) +
             codigoNumerico(8) + tipoEmision(1) + digitoVerificador(1)
    """
    fecha_str = fecha.replace("/", "")  # DDMMYYYY → 8 dígitos
    codigo_numerico = str(uuid.uuid4().int)[:8].zfill(8)

    clave_sin_verificador = (
        fecha_str +          # 8
        tipo_comprobante +   # 2
        ruc +                # 13
        ambiente +           # 1
        serie +              # 6
        numero.zfill(9) +    # 9
        codigo_numerico +    # 8
        tipo_emision         # 1
    )  # = 48 dígitos

    # Módulo 11
    digito = _modulo11(clave_sin_verificador)
    return clave_sin_verificador + str(digito)


def _modulo11(clave: str) -> int:
    """Calcula dígito verificador por módulo 11."""
    factores = [2, 3, 4, 5, 6, 7]
    suma = 0
    factor_idx = 0
    for c in reversed(clave):
        suma += int(c) * factores[factor_idx % 6]
        factor_idx += 1
    residuo = suma % 11
    if residuo == 0:
        return 0
    elif residuo == 1:
        return 1
    else:
        return 11 - residuo


# ─── Generar XML factura SRI v2.1.0 ─────────────────────────────────────────
def generar_xml_factura(factura: dict, clave_acceso: str, ambiente: str = "2") -> bytes:
    """
    Genera el XML de la factura según esquema SRI versión 2.1.0.
    factura: dict con todos los datos de la Invoice.
    """
    # Parsear número de factura: 001-001-000000001
    partes = factura.get("numero_factura", "001-001-000000001").split("-")
    establecimiento = partes[0] if len(partes) > 0 else "001"
    punto_emision = partes[1] if len(partes) > 1 else "001"
    secuencial = partes[2] if len(partes) > 2 else "000000001"

    fecha_emision = factura.get("fecha", datetime.now().strftime("%Y-%m-%d"))
    try:
        dt = datetime.strptime(fecha_emision, "%Y-%m-%d")
        fecha_str = dt.strftime("%d/%m/%Y")
    except Exception:
        fecha_str = datetime.now().strftime("%d/%m/%Y")

    # Calcular totales
    detalles = factura.get("detalles", [])
    if not detalles:
        detalles = [{
            "descripcion": factura.get("especialidad", "Servicio médico"),
            "cantidad": 1,
            "precio_unitario": factura.get("total", 0),
            "descuento": 0,
            "subtotal": factura.get("total", 0),
        }]

    subtotal_sin_impuesto = sum(
        float(d.get("precio_unitario", 0)) * float(d.get("cantidad", 1)) - float(d.get("descuento", 0))
        for d in detalles
    )
    subtotal_sin_impuesto = round(subtotal_sin_impuesto, 2)
    total = round(factura.get("total", subtotal_sin_impuesto), 2)
    descuento_total = round(
        sum(float(d.get("descuento", 0)) for d in detalles), 2
    )

    # Forma de pago SRI codes
    formas_pago_sri = {
        "efectivo": "01",
        "tarjeta": "19",
        "transferencia": "20",
        "cheque": "15",
        "seguro": "01",  # mapear a efectivo como default
    }
    forma_pago_codigo = formas_pago_sri.get(
        factura.get("tipo_pago", "efectivo"), "01"
    )

    # ── Root element ──
    factura_el = etree.Element("factura", id="comprobante", version="2.1.0")

    # ── infoTributaria ──
    info_trib = etree.SubElement(factura_el, "infoTributaria")
    _el(info_trib, "ambiente", ambiente)
    _el(info_trib, "tipoEmision", "1")
    _el(info_trib, "razonSocial", factura.get("emisor_razon_social", "FAMILY HEALTH"))
    _el(info_trib, "nombreComercial", factura.get("emisor_nombre_comercial", "FAMILY HEALTH"))
    _el(info_trib, "ruc", factura.get("emisor_ruc", ""))
    _el(info_trib, "claveAcceso", clave_acceso)
    _el(info_trib, "codDoc", "01")  # 01 = factura
    _el(info_trib, "estab", establecimiento)
    _el(info_trib, "ptoEmi", punto_emision)
    _el(info_trib, "secuencial", secuencial)
    _el(info_trib, "dirMatriz", factura.get("emisor_direccion", "Guayaquil"))

    # ── infoFactura ──
    info_fac = etree.SubElement(factura_el, "infoFactura")
    _el(info_fac, "fechaEmision", fecha_str)
    _el(info_fac, "dirEstablecimiento", factura.get("emisor_direccion", "Guayaquil"))
    _el(info_fac, "tipoIdentificacionComprador",
        _tipo_identificacion(factura.get("paciente_cedula", "")))
    _el(info_fac, "razonSocialComprador", factura.get("paciente_nombre", "CONSUMIDOR FINAL"))
    _el(info_fac, "identificacionComprador", factura.get("paciente_cedula", "9999999999999"))
    _el(info_fac, "totalSinImpuestos", f"{subtotal_sin_impuesto:.2f}")
    _el(info_fac, "totalDescuento", f"{descuento_total:.2f}")

    # totalConImpuestos — servicios médicos exentos (código 2, tarifa 0)
    total_impuestos = etree.SubElement(info_fac, "totalConImpuestos")
    total_imp = etree.SubElement(total_impuestos, "totalImpuesto")
    _el(total_imp, "codigo", "2")       # IVA
    _el(total_imp, "codigoPorcentaje", "0")  # 0% exento
    _el(total_imp, "baseImponible", f"{subtotal_sin_impuesto:.2f}")
    _el(total_imp, "valor", "0.00")

    _el(info_fac, "propina", "0.00")
    _el(info_fac, "importeTotal", f"{total:.2f}")
    _el(info_fac, "moneda", "DOLAR")

    # pagos
    pagos = etree.SubElement(info_fac, "pagos")
    pago = etree.SubElement(pagos, "pago")
    _el(pago, "formaPago", forma_pago_codigo)
    _el(pago, "total", f"{total:.2f}")
    _el(pago, "plazo", "0")
    _el(pago, "unidadTiempo", "dias")

    # ── detalles ──
    detalles_el = etree.SubElement(factura_el, "detalles")
    for det in detalles:
        if not det.get("descripcion"):
            continue
        det_el = etree.SubElement(detalles_el, "detalle")
        _el(det_el, "codigoPrincipal", "SRV001")
        _el(det_el, "descripcion", str(det.get("descripcion", "Servicio médico")))
        cant = float(det.get("cantidad", 1))
        precio = float(det.get("precio_unitario", 0))
        desc = float(det.get("descuento", 0))
        subtotal_det = round(precio * cant - desc, 2)
        _el(det_el, "cantidad", f"{cant:.2f}")
        _el(det_el, "precioUnitario", f"{precio:.6f}")
        _el(det_el, "descuento", f"{desc:.2f}")
        _el(det_el, "precioTotalSinImpuesto", f"{subtotal_det:.2f}")

        # impuestos del detalle
        impuestos_det = etree.SubElement(det_el, "impuestos")
        impuesto_det = etree.SubElement(impuestos_det, "impuesto")
        _el(impuesto_det, "codigo", "2")
        _el(impuesto_det, "codigoPorcentaje", "0")
        _el(impuesto_det, "tarifa", "0")
        _el(impuesto_det, "baseImponible", f"{subtotal_det:.2f}")
        _el(impuesto_det, "valor", "0.00")

    # ── infoAdicional ──
    info_adicional = etree.SubElement(factura_el, "infoAdicional")
    if factura.get("paciente_email"):
        camp = etree.SubElement(info_adicional, "campoAdicional", nombre="email")
        camp.text = factura["paciente_email"]
    if factura.get("paciente_telefono"):
        camp2 = etree.SubElement(info_adicional, "campoAdicional", nombre="telefono")
        camp2.text = factura["paciente_telefono"]
    if factura.get("doctor_nombre"):
        camp3 = etree.SubElement(info_adicional, "campoAdicional", nombre="medico")
        camp3.text = f"{factura['doctor_nombre']} - {factura.get('especialidad', '')}"

    return etree.tostring(factura_el, xml_declaration=True,
                          encoding="UTF-8", pretty_print=True)


def _el(parent, tag: str, text: str = ""):
    """Helper: create subelement with text."""
    el = etree.SubElement(parent, tag)
    el.text = text
    return el


def _tipo_identificacion(cedula: str) -> str:
    """
    04 = RUC (13 dígitos)
    05 = Cédula (10 dígitos)
    06 = Pasaporte
    07 = Consumidor final
    """
    if not cedula or cedula == "9999999999999":
        return "07"
    cedula_clean = re.sub(r'\D', '', cedula)
    if len(cedula_clean) == 13:
        return "04"
    elif len(cedula_clean) == 10:
        return "05"
    else:
        return "06"


# ─── Firmar XML con .p12 (XMLDSig) ───────────────────────────────────────────
def firmar_xml(xml_bytes: bytes, p12_bytes: bytes, p12_password: str) -> bytes:
    """
    Firma el XML con el certificado .p12 usando RSA-SHA1 (XMLDSig).
    Retorna el XML firmado como bytes.
    """
    try:
        password_bytes = p12_password.encode() if isinstance(p12_password, str) else p12_password
        private_key, certificate, chain = pkcs12.load_key_and_certificates(
            p12_bytes, password_bytes, backend=default_backend()
        )
    except Exception as e:
        raise ValueError(f"Error al cargar el certificado .p12: {e}")

    # Parsear XML
    doc = etree.fromstring(xml_bytes)

    # Obtener cert en DER y convertir a base64
    cert_der = certificate.public_bytes(Encoding.DER)
    cert_b64 = base64.b64encode(cert_der).decode()

    # Obtener public key info
    pub_key_der = certificate.public_key().public_bytes(
        Encoding.DER, PublicFormat.SubjectPublicKeyInfo
    )
    pub_key_b64 = base64.b64encode(pub_key_der).decode()

    # Canonicalizar el XML (C14N) para la firma
    xml_c14n = _canonicalize(doc)

    # Calcular digest (SHA1) del documento canonicalizado
    digest = hashlib.sha1(xml_c14n).digest()
    digest_b64 = base64.b64encode(digest).decode()

    # Construir SignedInfo
    signed_info_xml = f"""<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
<ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
<ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
<ds:Reference URI="#comprobante">
<ds:Transforms>
<ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
</ds:Transforms>
<ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
<ds:DigestValue>{digest_b64}</ds:DigestValue>
</ds:Reference>
</ds:SignedInfo>"""

    signed_info_el = etree.fromstring(signed_info_xml.encode())
    signed_info_c14n = _canonicalize(signed_info_el)

    # Firmar con la clave privada (RSA-SHA1)
    signature_bytes = private_key.sign(signed_info_c14n, padding.PKCS1v15(), hashes.SHA1())
    signature_b64 = base64.b64encode(signature_bytes).decode()

    # Calcular serial e issuer del certificado
    cert_serial = str(certificate.serial_number)
    cert_issuer = certificate.issuer.rfc4514_string()

    # Thumbprint del certificado
    thumbprint = hashlib.sha1(cert_der).digest()
    thumbprint_b64 = base64.b64encode(thumbprint).decode()

    # Construir elemento Signature completo
    sig_id = f"Signature-{uuid.uuid4().hex[:8]}"
    key_info_id = f"KeyInfo-{uuid.uuid4().hex[:8]}"

    signature_xml = f"""<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="{sig_id}">
{signed_info_xml}
<ds:SignatureValue>{signature_b64}</ds:SignatureValue>
<ds:KeyInfo Id="{key_info_id}">
<ds:X509Data>
<ds:X509Certificate>{cert_b64}</ds:X509Certificate>
</ds:X509Data>
</ds:KeyInfo>
</ds:Signature>"""

    sig_el = etree.fromstring(signature_xml.encode())
    doc.append(sig_el)

    return etree.tostring(doc, xml_declaration=True, encoding="UTF-8", pretty_print=False)


def _canonicalize(element) -> bytes:
    """Serializa un elemento XML en forma canónica (C14N)."""
    buf = BytesIO()
    element.getroottree().write_c14n(buf) if hasattr(element, 'getroottree') else \
        etree.ElementTree(element).write_c14n(buf)
    return buf.getvalue()


# ─── Enviar al SRI ───────────────────────────────────────────────────────────
async def enviar_al_sri(xml_firmado: bytes, ambiente: str = "produccion") -> dict:
    """
    Envía el XML firmado al webservice del SRI (SOAP).
    Retorna: { ok, estado, clave_acceso, mensaje, autorizacion }
    """
    import httpx

    url = SRI_AMBIENTES.get(ambiente, SRI_AMBIENTES["produccion"])["recepcion"]

    # Codificar XML en base64 para el envelope SOAP
    xml_b64 = base64.b64encode(xml_firmado).decode()

    soap_envelope = f"""<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:ec="http://ec.gob.sri.ws.recepcion">
    <soapenv:Header/>
    <soapenv:Body>
        <ec:validarComprobante>
            <xml>{xml_b64}</xml>
        </ec:validarComprobante>
    </soapenv:Body>
</soapenv:Envelope>"""

    headers = {
        "Content-Type": "text/xml; charset=UTF-8",
        "SOAPAction": "",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0, verify=True) as client:
            response = await client.post(url, content=soap_envelope.encode("UTF-8"), headers=headers)

        if response.status_code != 200:
            return {
                "ok": False,
                "estado": "ERROR",
                "mensaje": f"SRI respondió HTTP {response.status_code}",
                "respuesta_raw": response.text[:500],
            }

        # Parsear respuesta SOAP
        resultado = _parsear_respuesta_recepcion(response.text)
        return resultado

    except httpx.TimeoutException:
        return {"ok": False, "estado": "TIMEOUT", "mensaje": "El SRI no respondió en 30 segundos. Intenta de nuevo."}
    except Exception as e:
        return {"ok": False, "estado": "ERROR", "mensaje": str(e)}


def _parsear_respuesta_recepcion(soap_response: str) -> dict:
    """Parsea la respuesta SOAP del SRI."""
    try:
        root = etree.fromstring(soap_response.encode())
        ns = {"ns": "http://ec.gob.sri.ws.recepcion"}

        # Buscar estado
        estado_el = root.find(".//{*}estado")
        estado = estado_el.text if estado_el is not None else "DESCONOCIDO"

        # Buscar mensajes de error
        mensajes = []
        for comp in root.findall(".//{*}comprobante"):
            for msg in comp.findall(".//{*}mensaje"):
                ident = msg.find("{*}identificador") or msg.find("identificador")
                info = msg.find("{*}informacionAdicional") or msg.find("informacionAdicional")
                tipo = msg.find("{*}tipo") or msg.find("tipo")
                m_text = ""
                if ident is not None: m_text += f"[{ident.text}] "
                if info is not None: m_text += info.text or ""
                if m_text: mensajes.append(m_text.strip())

        return {
            "ok": estado == "RECIBIDA",
            "estado": estado,
            "mensaje": "; ".join(mensajes) if mensajes else (
                "Comprobante recibido por el SRI" if estado == "RECIBIDA" else estado
            ),
        }
    except Exception as e:
        return {"ok": False, "estado": "ERROR_PARSE", "mensaje": f"Error al parsear respuesta SRI: {e}"}


async def autorizar_en_sri(clave_acceso: str, ambiente: str = "produccion") -> dict:
    """
    Consulta la autorización de un comprobante ya enviado.
    Retorna: { ok, estado, numero_autorizacion, fecha_autorizacion, mensaje }
    """
    import httpx

    url = SRI_AMBIENTES.get(ambiente, SRI_AMBIENTES["produccion"])["autorizacion"]

    soap_envelope = f"""<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:ec="http://ec.gob.sri.ws.autorizacion">
    <soapenv:Header/>
    <soapenv:Body>
        <ec:autorizacionComprobante>
            <claveAccesoComprobante>{clave_acceso}</claveAccesoComprobante>
        </ec:autorizacionComprobante>
    </soapenv:Body>
</soapenv:Envelope>"""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url,
                content=soap_envelope.encode("UTF-8"),
                headers={"Content-Type": "text/xml; charset=UTF-8", "SOAPAction": ""}
            )

        if response.status_code != 200:
            return {"ok": False, "estado": "ERROR", "mensaje": f"HTTP {response.status_code}"}

        return _parsear_respuesta_autorizacion(response.text)

    except httpx.TimeoutException:
        return {"ok": False, "estado": "TIMEOUT", "mensaje": "Timeout consultando autorización"}
    except Exception as e:
        return {"ok": False, "estado": "ERROR", "mensaje": str(e)}


def _parsear_respuesta_autorizacion(soap_response: str) -> dict:
    """Parsea la respuesta de autorización del SRI."""
    try:
        root = etree.fromstring(soap_response.encode())

        numero_el = root.find(".//{*}numeroAutorizacion")
        fecha_el = root.find(".//{*}fechaAutorizacion")
        estado_el = root.find(".//{*}estado")

        numero = numero_el.text if numero_el is not None else ""
        fecha = fecha_el.text if fecha_el is not None else ""
        estado = estado_el.text if estado_el is not None else "DESCONOCIDO"

        return {
            "ok": estado == "AUTORIZADO",
            "estado": estado,
            "numero_autorizacion": numero,
            "fecha_autorizacion": fecha,
            "mensaje": "Comprobante AUTORIZADO por el SRI" if estado == "AUTORIZADO"
                      else f"Estado: {estado}",
        }
    except Exception as e:
        return {"ok": False, "estado": "ERROR_PARSE", "mensaje": str(e)}


# ─── Cargar/guardar .p12 desde MongoDB ───────────────────────────────────────
async def get_p12_desde_mongo(db) -> tuple:
    """
    Lee el certificado .p12 desde MongoDB.
    Retorna: (p12_bytes, password, ambiente)
    """
    cfg = await db.configuracion.find_one({"clave": "firma_electronica"}, {"_id": 0})
    if not cfg or not cfg.get("valor"):
        return None, None, "produccion"
    val = cfg["valor"]
    p12_b64 = val.get("p12_base64", "")
    password = val.get("password", "")
    ambiente = val.get("ambiente", "produccion")
    if not p12_b64:
        return None, None, ambiente
    p12_bytes = base64.b64decode(p12_b64)
    return p12_bytes, password, ambiente