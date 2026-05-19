"""
sri_facturacion.py — Facturación electrónica SRI Ecuador para Family Health.
Genera XML 2.1.0, firma con .p12 (RSA-SHA1), envía al webservice SRI (SOAP).
"""
import hashlib, base64, uuid, re
from datetime import datetime, timezone
from io import BytesIO
from lxml import etree
from cryptography.hazmat.primitives.serialization import pkcs12, Encoding, PublicFormat
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.backends import default_backend

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

def _modulo11(clave: str) -> int:
    factores = [2, 3, 4, 5, 6, 7]
    suma = 0
    for i, c in enumerate(reversed(clave)):
        suma += int(c) * factores[i % 6]
    r = suma % 11
    return 0 if r == 0 else (1 if r == 1 else 11 - r)

def generar_clave_acceso(fecha, tipo_comprobante, ruc, ambiente, serie, numero, tipo_emision="1"):
    fecha_str = fecha.replace("/", "")
    cod_num = str(uuid.uuid4().int)[:8].zfill(8)
    clave_sin = fecha_str + tipo_comprobante + ruc + ambiente + serie + numero.zfill(9) + cod_num + tipo_emision
    return clave_sin + str(_modulo11(clave_sin))

def _el(parent, tag, text=""):
    el = etree.SubElement(parent, tag)
    el.text = text
    return el

def _tipo_identificacion(cedula):
    if not cedula or cedula == "9999999999999": return "07"
    c = re.sub(r'\D', '', cedula)
    if len(c) == 13: return "04"
    if len(c) == 10: return "05"
    return "06"

def generar_xml_factura(factura, clave_acceso, ambiente="2"):
    partes = factura.get("numero_factura", "001-001-000000001").split("-")
    est = partes[0] if len(partes) > 0 else "001"
    pto = partes[1] if len(partes) > 1 else "001"
    seq = partes[2] if len(partes) > 2 else "000000001"
    fecha_raw = factura.get("fecha", datetime.now().strftime("%Y-%m-%d"))
    try:
        fecha_str = datetime.strptime(fecha_raw, "%Y-%m-%d").strftime("%d/%m/%Y")
    except:
        fecha_str = datetime.now().strftime("%d/%m/%Y")
    detalles = factura.get("detalles", [])
    if not detalles:
        detalles = [{"descripcion": factura.get("especialidad","Servicio médico"), "cantidad":1, "precio_unitario":factura.get("total",0), "descuento":0}]
    subtotal = round(sum(float(d.get("precio_unitario",0))*float(d.get("cantidad",1))-float(d.get("descuento",0)) for d in detalles), 2)
    total = round(factura.get("total", subtotal), 2)
    desc_total = round(sum(float(d.get("descuento",0)) for d in detalles), 2)
    fpago = {"efectivo":"01","tarjeta":"19","transferencia":"20","cheque":"15"}.get(factura.get("tipo_pago","efectivo"),"01")
    fac = etree.Element("factura", id="comprobante", version="2.1.0")
    it = etree.SubElement(fac, "infoTributaria")
    _el(it,"ambiente",ambiente); _el(it,"tipoEmision","1")
    _el(it,"razonSocial",factura.get("emisor_razon_social","FAMILY HEALTH"))
    _el(it,"nombreComercial",factura.get("emisor_nombre_comercial","FAMILY HEALTH"))
    _el(it,"ruc",factura.get("emisor_ruc",""))
    _el(it,"claveAcceso",clave_acceso); _el(it,"codDoc","01")
    _el(it,"estab",est); _el(it,"ptoEmi",pto); _el(it,"secuencial",seq)
    _el(it,"dirMatriz",factura.get("emisor_direccion","Guayaquil"))
    inf = etree.SubElement(fac,"infoFactura")
    _el(inf,"fechaEmision",fecha_str)
    _el(inf,"dirEstablecimiento",factura.get("emisor_direccion","Guayaquil"))
    _el(inf,"tipoIdentificacionComprador",_tipo_identificacion(factura.get("paciente_cedula","")))
    _el(inf,"razonSocialComprador",factura.get("paciente_nombre","CONSUMIDOR FINAL"))
    _el(inf,"identificacionComprador",factura.get("paciente_cedula","9999999999999"))
    _el(inf,"totalSinImpuestos",f"{subtotal:.2f}"); _el(inf,"totalDescuento",f"{desc_total:.2f}")
    ti = etree.SubElement(inf,"totalConImpuestos"); tmp = etree.SubElement(ti,"totalImpuesto")
    _el(tmp,"codigo","2"); _el(tmp,"codigoPorcentaje","0"); _el(tmp,"baseImponible",f"{subtotal:.2f}"); _el(tmp,"valor","0.00")
    _el(inf,"propina","0.00"); _el(inf,"importeTotal",f"{total:.2f}"); _el(inf,"moneda","DOLAR")
    pagos = etree.SubElement(inf,"pagos"); pago = etree.SubElement(pagos,"pago")
    _el(pago,"formaPago",fpago); _el(pago,"total",f"{total:.2f}"); _el(pago,"plazo","0"); _el(pago,"unidadTiempo","dias")
    dets = etree.SubElement(fac,"detalles")
    for d in detalles:
        if not d.get("descripcion"): continue
        de = etree.SubElement(dets,"detalle")
        _el(de,"codigoPrincipal","SRV001"); _el(de,"descripcion",str(d.get("descripcion","")))
        cant = float(d.get("cantidad",1)); precio = float(d.get("precio_unitario",0)); desc = float(d.get("descuento",0))
        sub_d = round(precio*cant-desc,2)
        _el(de,"cantidad",f"{cant:.2f}"); _el(de,"precioUnitario",f"{precio:.6f}")
        _el(de,"descuento",f"{desc:.2f}"); _el(de,"precioTotalSinImpuesto",f"{sub_d:.2f}")
        imps = etree.SubElement(de,"impuestos"); imp = etree.SubElement(imps,"impuesto")
        _el(imp,"codigo","2"); _el(imp,"codigoPorcentaje","0"); _el(imp,"tarifa","0")
        _el(imp,"baseImponible",f"{sub_d:.2f}"); _el(imp,"valor","0.00")
    ia = etree.SubElement(fac,"infoAdicional")
    if factura.get("paciente_email"):
        c=etree.SubElement(ia,"campoAdicional",nombre="email"); c.text=factura["paciente_email"]
    if factura.get("doctor_nombre"):
        c=etree.SubElement(ia,"campoAdicional",nombre="medico"); c.text=f"{factura['doctor_nombre']} - {factura.get('especialidad','')}"
    return etree.tostring(fac, xml_declaration=True, encoding="UTF-8", pretty_print=True)

def _canonicalize(element):
    buf = BytesIO()
    etree.ElementTree(element).write_c14n(buf)
    return buf.getvalue()

def firmar_xml(xml_bytes, p12_bytes, p12_password):
    pw = p12_password.encode() if isinstance(p12_password, str) else p12_password
    pk, cert, chain = pkcs12.load_key_and_certificates(p12_bytes, pw, default_backend())
    doc = etree.fromstring(xml_bytes)
    cert_der = cert.public_bytes(Encoding.DER)
    cert_b64 = base64.b64encode(cert_der).decode()
    xml_c14n = _canonicalize(doc)
    digest = hashlib.sha1(xml_c14n).digest()
    digest_b64 = base64.b64encode(digest).decode()
    signed_info_xml = f"""<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
<ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
<ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
<ds:Reference URI="#comprobante">
<ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/></ds:Transforms>
<ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
<ds:DigestValue>{digest_b64}</ds:DigestValue>
</ds:Reference>
</ds:SignedInfo>"""
    si_el = etree.fromstring(signed_info_xml.encode())
    si_c14n = _canonicalize(si_el)
    sig_bytes = pk.sign(si_c14n, padding.PKCS1v15(), hashes.SHA1())
    sig_b64 = base64.b64encode(sig_bytes).decode()
    sig_id = f"Signature-{uuid.uuid4().hex[:8]}"
    ki_id = f"KeyInfo-{uuid.uuid4().hex[:8]}"
    signature_xml = f"""<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="{sig_id}">
{signed_info_xml}
<ds:SignatureValue>{sig_b64}</ds:SignatureValue>
<ds:KeyInfo Id="{ki_id}"><ds:X509Data><ds:X509Certificate>{cert_b64}</ds:X509Certificate></ds:X509Data></ds:KeyInfo>
</ds:Signature>"""
    doc.append(etree.fromstring(signature_xml.encode()))
    return etree.tostring(doc, xml_declaration=True, encoding="UTF-8", pretty_print=False)

async def enviar_al_sri(xml_firmado, ambiente="produccion"):
    import httpx
    url = SRI_AMBIENTES.get(ambiente, SRI_AMBIENTES["produccion"])["recepcion"]
    xml_b64 = base64.b64encode(xml_firmado).decode()
    soap = f"""<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.recepcion">
<soapenv:Header/><soapenv:Body><ec:validarComprobante><xml>{xml_b64}</xml></ec:validarComprobante></soapenv:Body></soapenv:Envelope>"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(url, content=soap.encode("UTF-8"), headers={"Content-Type":"text/xml; charset=UTF-8","SOAPAction":""})
        if r.status_code != 200:
            return {"ok":False,"estado":"ERROR","mensaje":f"SRI HTTP {r.status_code}"}
        return _parsear_respuesta_recepcion(r.text)
    except httpx.TimeoutException:
        return {"ok":False,"estado":"TIMEOUT","mensaje":"El SRI no respondió en 30s"}
    except Exception as e:
        return {"ok":False,"estado":"ERROR","mensaje":str(e)}

def _parsear_respuesta_recepcion(soap):
    try:
        root = etree.fromstring(soap.encode())
        estado = root.find(".//{*}estado")
        estado_txt = estado.text if estado is not None else "DESCONOCIDO"
        msgs = []
        for m in root.findall(".//{*}mensaje"):
            info = m.find("{*}informacionAdicional") or m.find("informacionAdicional")
            if info is not None and info.text: msgs.append(info.text)
        return {"ok": estado_txt=="RECIBIDA","estado":estado_txt,"mensaje":"; ".join(msgs) or ("Recibida" if estado_txt=="RECIBIDA" else estado_txt)}
    except Exception as e:
        return {"ok":False,"estado":"ERROR_PARSE","mensaje":str(e)}

async def autorizar_en_sri(clave_acceso, ambiente="produccion"):
    import httpx
    url = SRI_AMBIENTES.get(ambiente, SRI_AMBIENTES["produccion"])["autorizacion"]
    soap = f"""<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.autorizacion">
<soapenv:Header/><soapenv:Body><ec:autorizacionComprobante><claveAccesoComprobante>{clave_acceso}</claveAccesoComprobante></ec:autorizacionComprobante></soapenv:Body></soapenv:Envelope>"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(url, content=soap.encode("UTF-8"), headers={"Content-Type":"text/xml; charset=UTF-8","SOAPAction":""})
        if r.status_code != 200:
            return {"ok":False,"estado":"ERROR","mensaje":f"HTTP {r.status_code}"}
        return _parsear_respuesta_autorizacion(r.text)
    except httpx.TimeoutException:
        return {"ok":False,"estado":"TIMEOUT","mensaje":"Timeout consultando autorización"}
    except Exception as e:
        return {"ok":False,"estado":"ERROR","mensaje":str(e)}

def _parsear_respuesta_autorizacion(soap):
    try:
        root = etree.fromstring(soap.encode())
        num = root.find(".//{*}numeroAutorizacion")
        fecha = root.find(".//{*}fechaAutorizacion")
        estado = root.find(".//{*}estado")
        numero = num.text if num is not None else ""
        estado_txt = estado.text if estado is not None else "DESCONOCIDO"
        return {"ok":estado_txt=="AUTORIZADO","estado":estado_txt,"numero_autorizacion":numero,"fecha_autorizacion":fecha.text if fecha else "","mensaje":"Comprobante AUTORIZADO" if estado_txt=="AUTORIZADO" else estado_txt}
    except Exception as e:
        return {"ok":False,"estado":"ERROR_PARSE","mensaje":str(e)}

async def get_p12_desde_mongo(db):
    cfg = await db.configuracion.find_one({"clave":"firma_electronica"},{"_id":0})
    if not cfg or not cfg.get("valor"): return None, None, "produccion"
    val = cfg["valor"]
    p12_b64 = val.get("p12_base64","")
    if not p12_b64: return None, None, val.get("ambiente","produccion")
    return base64.b64decode(p12_b64), val.get("password",""), val.get("ambiente","produccion")