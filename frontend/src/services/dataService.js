import apiClient from "../lib/axios";

export const getDoctors = () => apiClient.get("/doctors");
export const getAppointments = () => apiClient.get("/appointments");
export const getEspecialidades = () => apiClient.get("/especialidades");
export const getCategories = () => apiClient.get("/categories");
export const getInvoices = () => apiClient.get("/invoices");
export const getInventory = () => apiClient.get("/inventory");
export const getDoctorPayments = () => apiClient.get("/doctor-payments");
export const getInvoiceMonthlyTotals = () => apiClient.get("/invoices/monthly-totals");
export const getMedicalHistory = () => apiClient.get("/medical-history");
export const getPrescriptions = () => apiClient.get("/prescriptions");
export const getUsers = () => apiClient.get("/users");

export const getAllAppData = async (isAdmin) => {
  const promises = [
    getDoctors(),
    getAppointments(),
    getEspecialidades(),
    getCategories(),
    getInvoices(),
    getInventory(),
    getDoctorPayments(),
    getInvoiceMonthlyTotals(),
    getMedicalHistory(),
    getPrescriptions(),
  ];

  if (isAdmin) {
    promises.push(getUsers());
  }

  return Promise.all(promises);
};
