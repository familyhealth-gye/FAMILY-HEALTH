import { useState, useContext } from "react";
import { AuthContext } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Stethoscope } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const Login = () => {
  const { login } = useContext(AuthContext);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const result = await login(username, password);
    if (!result.success) {
      toast.error(result.message);
    }
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <Stethoscope className="login-logo-icon" />
          <h1 className="login-title">Family Health</h1>
          <p className="login-subtitle">Sistema Médico Integral</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-field">
            <Label>Usuario</Label>
            <Input
              data-testid="username-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ingrese su usuario"
              required
              autoFocus
            />
          </div>

          <div className="form-field">
            <Label>Contraseña</Label>
            <Input
              data-testid="password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingrese su contraseña"
              required
            />
          </div>

          <Button type="submit" className="login-button" disabled={loading} data-testid="login-button">
            {loading ? "Ingresando..." : "Iniciar Sesión"}
          </Button>
        </form>

        <div className="login-footer">
          <p>Toledo Externo, Mz 2833 V15 - Guayaquil</p>
          <p>Tel: 0962912170</p>
        </div>
      </div>
    </div>
  );
};
