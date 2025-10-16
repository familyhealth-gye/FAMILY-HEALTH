import { Package, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";

export const InventoryTab = ({ inventory, searchInventory, setSearchInventory }) => {
  const filteredInventory = inventory.filter(i =>
    i.nombre.toLowerCase().includes(searchInventory.toLowerCase()) ||
    i.categoria.toLowerCase().includes(searchInventory.toLowerCase())
  );

  return (
    <div className="tab-content">
      <div className="section-header">
        <div>
          <h2 className="section-title">Inventario Médico</h2>
          <p className="section-subtitle">Control de insumos y materiales</p>
        </div>
      </div>
      
      <div className="search-box">
        <Input
          placeholder="Buscar por nombre o categoría..."
          value={searchInventory}
          onChange={(e) => setSearchInventory(e.target.value)}
          data-testid="search-inventory-input"
        />
      </div>
      
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Categoría</th>
              <th>Cantidad</th>
              <th>Costo Unit.</th>
              <th>Stock Mín.</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filteredInventory.map((item) => (
              <tr key={item.id} className={item.cantidad <= item.stock_minimo ? 'low-stock-row' : ''}>
                <td>{item.nombre}</td>
                <td><span className="badge">{item.categoria}</span></td>
                <td><strong>{item.cantidad}</strong></td>
                <td>${item.costo_unitario.toFixed(2)}</td>
                <td>{item.stock_minimo}</td>
                <td>
                  {item.cantidad <= item.stock_minimo ? (
                    <span className="stock-alert">
                      <AlertTriangle className="alert-icon-small" />
                      Bajo
                    </span>
                  ) : (
                    <span className="stock-ok">OK</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredInventory.length === 0 && (
          <div className="empty-state">
            <Package className="empty-icon" />
            <p>No hay items en inventario</p>
          </div>
        )}
      </div>
    </div>
  );
};
