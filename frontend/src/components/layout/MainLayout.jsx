import React from "react";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "../ui/button";
import { LogOut } from "lucide-react";

export const MainLayout = ({ children }) => {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="App">
      <header className="medical-header">
        <div className="header-content">
          <div className="logo-section">
            <img src="/logo.png" alt="Family Health" className="logo-image" />
            <div>
              <h1 className="clinic-name">Family Health</h1>
              <p className="clinic-location">Toledo Externo, Mz 2833 V15 - Guayaquil</p>
            </div>
          </div>
          <div className="user-section">
            <div style={{ textAlign: "right" }}>
              <div className="user-name">{user.nombre_completo || user.nombre || user.username}</div>
              <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", marginTop: "2px" }}>
                {user.especialidad && (
                  <span style={{ background: "rgba(255,255,255,0.2)", color: "white", borderRadius: "10px", padding: "1px 8px", fontSize: "11px" }}>
                    {user.especialidad}
                  </span>
                )}
                <span className="user-role">{user.role}</span>
              </div>
            </div>
            <Button variant="ghost" onClick={logout} className="logout-button">
              <LogOut className="button-icon" />
              Salir
            </Button>
          </div>
        </div>
      </header>
      <main className="main-container">
        {children}
      </main>
    </div>
  );
};
