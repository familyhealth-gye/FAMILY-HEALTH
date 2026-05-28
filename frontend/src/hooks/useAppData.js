/**
 * useAppData.js
 * Centraliza la carga de datos globales del sistema.
 * Extraído de LegacyApp en App.js para separar lógica de datos del árbol de UI.
 *
 * Uso:
 *   const { doctors, appointments, ..., fetchData, loading } = useAppData(user, isAuthenticated);
 */

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { getAllAppData } from "@/services/dataService";

export function useAppData(user, isAuthenticated) {
  const [users,          setUsers]          = useState([]);
  const [doctors,        setDoctors]        = useState([]);
  const [appointments,   setAppointments]   = useState([]);
  const [invoices,       setInvoices]       = useState([]);
  const [inventory,      setInventory]      = useState([]);
  const [doctorPayments, setDoctorPayments] = useState([]);
  const [medicalHistories, setMedicalHistories] = useState([]);
  const [prescriptions,  setPrescriptions]  = useState([]);
  const [specialties,    setSpecialties]    = useState([]);
  const [categories,     setCategories]     = useState([]);
  const [monthlyTotals,  setMonthlyTotals]  = useState({});
  const [loading,        setLoading]        = useState(false);

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    try {
      const results = await getAllAppData(user?.role === "Administrador");

      setDoctors(results[0].data);
      setAppointments(results[1].data);

      const especialidadesArray = Array.isArray(results[2].data)
        ? results[2].data.map(e => e.nombre)
        : [];
      setSpecialties(especialidadesArray);

      setCategories(results[3].data.categories || []);
      setInvoices(results[4].data);
      setInventory(results[5].data);
      setDoctorPayments(results[6].data);
      setMonthlyTotals(results[7].data.monthly_totals || {});
      setMedicalHistories(results[8].data);
      setPrescriptions(results[9].data);

      if (user?.role === "Administrador" && results[10]) {
        setUsers(results[10].data);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Error al cargar datos del sistema");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user?.role]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    users, doctors, appointments, invoices, inventory,
    doctorPayments, medicalHistories, prescriptions,
    specialties, categories, monthlyTotals,
    loading, fetchData,
  };
}
