import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import axios from "axios";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const InvoicesTab = ({ invoices, searchInvoice, setSearchInvoice, monthlyTotals }) => {
  const handleExport = async () => {
    try {
      const response = await axios.get(`${API}/invoices/export`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'facturas_family_health.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Facturas exportadas");
    } catch (error) {
      toast.error("Error al exportar");
    }
  };

  const filteredInvoices = invoices.filter(i =>
    i.paciente_nombre.toLowerCase().includes(searchInvoice.toLowerCase()) ||
    i.numero_factura.includes(searchInvoice) ||
    i.doctor_nombre.toLowerCase().includes(searchInvoice.toLowerCase())
  );

  const totalThisMonth = Object.values(monthlyTotals).reduce((a, b) => a + b, 0);

  return (
    <div className="tab-content">
      <div className="section-header">
        <div>
          <h2 className="section-title">Gestión de Facturas</h2>
          <p className="section-subtitle">Total facturado: ${totalThisMonth.toFixed(2)}</p>
        </div>
        <Button onClick={handleExport} variant="outline" data-testid="export-invoices-button">
          <Download className="button-icon" />
          Exportar CSV
        </Button>
      </div>
      
      <div className="search-box">
        <Input
          placeholder="Buscar por paciente, doctor o número de factura..."
          value={searchInvoice}
          onChange={(e) => setSearchInvoice(e.target.value)}
          data-testid="search-invoice-input"
        />
      </div>
      
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>N° Factura</th>
              <th>Paciente</th>
              <th>Doctor</th>
              <th>Servicio</th>
              <th>Valor</th>
              <th>Fecha</th>
              <th>Pago</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.map((invoice) => (
              <tr key={invoice.id}>
                <td><strong>{invoice.numero_factura}</strong></td>
                <td>{invoice.paciente_nombre}</td>
                <td>{invoice.doctor_nombre}</td>
                <td>{invoice.servicio}</td>
                <td className="amount-cell">${invoice.valor.toFixed(2)}</td>
                <td>{invoice.fecha}</td>
                <td><span className="badge-payment">{invoice.tipo_pago}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredInvoices.length === 0 && (
          <div className="empty-state">
            <FileText className="empty-icon" />
            <p>No hay facturas registradas</p>
          </div>
        )}
      </div>
    </div>
  );
};
