import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, User, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DentalHeader = ({ appointment }) => {
  const navigate = useNavigate();

  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex flex-col">
          <h1 className="text-sm font-bold flex items-center gap-2">
            <User className="w-4 h-4 text-medical-600" />
            {appointment?.paciente_nombre || 'Paciente'}
          </h1>
          <p className="text-xs text-slate-500 flex items-center gap-2">
            <Calendar className="w-3 h-3" />
            Atención Odontológica - {appointment?.fecha || ''}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline">Finalizar Sesión</Button>
      </div>
    </header>
  );
};

export default DentalHeader;
