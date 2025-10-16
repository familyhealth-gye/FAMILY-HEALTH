import { DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import axios from "axios";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const PaymentsTab = ({ doctorPayments, fetchData }) => {
  const handleUpdateStatus = async (paymentId) => {
    try {
      await axios.put(`${API}/doctor-payments/${paymentId}`, { estado: "Pagado" });
      toast.success("Estado actualizado");
      fetchData();
    } catch (error) {
      toast.error("Error al actualizar");
    }
  };

  return (
    <div className="tab-content">
      <div className="section-header">
        <div>
          <h2 className="section-title">Pagos a Doctores</h2>
          <p className="section-subtitle">Control de comisiones y pagos</p>
        </div>
      </div>
      
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Doctor</th>
              <th>Mes/Año</th>
              <th>Total Facturado</th>
              <th>% Comisión</th>
              <th>Total a Pagar</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {doctorPayments.map((payment) => (
              <tr key={payment.id}>
                <td><strong>{payment.doctor_nombre}</strong></td>
                <td>{payment.mes}/{payment.año}</td>
                <td className="amount-cell">${payment.total_facturado.toFixed(2)}</td>
                <td>{payment.porcentaje}%</td>
                <td className="amount-cell"><strong>${payment.total_pagar.toFixed(2)}</strong></td>
                <td>
                  <span className={payment.estado === "Pagado" ? "status-paid" : "status-pending"}>
                    {payment.estado}
                  </span>
                </td>
                <td>
                  {payment.estado === "Pendiente" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateStatus(payment.id)}
                      data-testid={`mark-paid-${payment.id}`}
                    >
                      Marcar Pagado
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {doctorPayments.length === 0 && (
          <div className="empty-state">
            <DollarSign className="empty-icon" />
            <p>No hay pagos registrados</p>
          </div>
        )}
      </div>
    </div>
  );
};
