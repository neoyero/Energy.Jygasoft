import React, { useState } from 'react';
import { LeadData } from '../types';
import { Calendar, CheckCircle2, ChevronRight, Phone, MessageSquare, Mail, MapPin } from 'lucide-react';

export default function LeadForm() {
  const [formData, setFormData] = useState<LeadData>({
    name: '',
    email: '',
    phone: '',
    state: 'Ciudad de México',
    monthlyBill: 3500,
    contactMethod: 'whatsapp'
  });
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const states = [
    'Ciudad de México',
    'Estado de México',
    'Nuevo León',
    'Jalisco',
    'Querétaro',
    'Guanajuato',
    'Sonora',
    'Quintana Roo',
    'Baja California',
    'Puebla',
    'Yucatán',
    'Chihuahua'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Ocurrió un error al enviar tus datos.');
      }

      setSuccessMsg(data.message);
      setFormData({
        name: '',
        email: '',
        phone: '',
        state: 'Ciudad de México',
        monthlyBill: 3500,
        contactMethod: 'whatsapp'
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al conectar con el servidor.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="contacto" className="py-24 bg-[#002612] text-white overflow-hidden relative">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-[#206c3b]/20 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#f5b301]/10 rounded-full blur-3xl pointer-events-none translate-x-1/3 translate-y-1/3"></div>

      <div className="max-w-7xl mx-auto px-6 sm:px-12 relative z-10 animate-float">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          
          {/* Pitch Info Column */}
          <div className="lg:col-span-5 space-y-8">
            <span className="text-xs font-bold uppercase tracking-widest text-[#a2d2af]">Agenda tu Asesoría</span>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
              Inicia tu transición a un hogar inteligente.
            </h2>
            <p className="text-[#a2d2af] text-lg font-light leading-relaxed">
              Consigue una cotización formal y personalizada sin compromiso alguno. Realizamos estudios de sombreado 3D y análisis de viabilidad técnica gratis.
            </p>

            <div className="space-y-6 pt-4 border-t border-white/10 text-[#a2d2af]">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/15">
                  <MapPin className="w-5 h-5 text-[#f5b301]" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Cobertura Nacional</h4>
                  <span className="text-xs">Estudios técnicos en toda la República Mexicana</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/15">
                  <Calendar className="w-5 h-5 text-[#f5b301]" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Estudio 3D Gratuito</h4>
                  <span className="text-xs">Ubicamos los paneles solares óptimamente</span>
                </div>
              </div>
            </div>
          </div>

          {/* Form / Lead Submit Card */}
          <div className="lg:col-span-7 bg-white text-stone-800 rounded-3xl p-8 sm:p-10 shadow-xl border border-white/10 relative">
            {successMsg ? (
              <div className="py-12 px-4 text-center space-y-6">
                <div className="w-20 h-20 bg-[#a4f1b4]/30 text-[#206c3b] rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-12 h-12" />
                </div>
                <h3 className="text-2xl font-extrabold text-[#002612] tracking-tight">¡Solicitud Enviada con Éxito!</h3>
                <p className="text-stone-600 text-sm max-w-md mx-auto leading-relaxed">
                  {successMsg}
                </p>
                <button
                  type="button"
                  onClick={() => setSuccessMsg('')}
                  className="inline-flex items-center gap-2 text-xs font-bold text-[#206c3b] uppercase tracking-widest hover:underline"
                >
                  Enviar otra cotización
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h3 id="cotiza" className="text-2xl font-extrabold text-[#002612] tracking-tight">Agendar Estudio Técnico Gratis</h3>
                  <p className="text-xs text-stone-500 mt-1">Completa los datos para coordinar una llamada experta con tu recibo de CFE.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-600 mb-1.5 uppercase tracking-wider">
                        Nombre completo
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Ej. Juan Pérez"
                        required
                        className="w-full px-4 py-3 bg-[#f8faf9] text-stone-800 placeholder-stone-450 border border-stone-200 rounded-xl focus:border-[#206c3b] outline-none text-sm font-light transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-600 mb-1.5 uppercase tracking-wider">
                        Correo electrónico
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="ejemplo@correo.com"
                        required
                        className="w-full px-4 py-3 bg-[#f8faf9] text-stone-800 placeholder-stone-450 border border-stone-200 rounded-xl focus:border-[#206c3b] outline-none text-sm font-light transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-600 mb-1.5 uppercase tracking-wider">
                        WhatsApp / Teléfono
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="10 dígitos con lada"
                        required
                        className="w-full px-4 py-3 bg-[#f8faf9] text-stone-800 placeholder-stone-450 border border-stone-200 rounded-xl focus:border-[#206c3b] outline-none text-sm font-light transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-600 mb-1.5 uppercase tracking-wider">
                        Estado residencial
                      </label>
                      <select
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        className="w-full px-4 py-3 bg-[#f8faf9] border border-stone-200 rounded-xl focus:border-[#206c3b] outline-none text-sm font-light transition-all"
                      >
                        {states.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-600 mb-1.5 uppercase tracking-wider">
                      ¿Cuánto pagas de luz bimestralmente?
                    </label>
                    <select
                      value={formData.monthlyBill}
                      onChange={(e) => setFormData({ ...formData, monthlyBill: Number(e.target.value) })}
                      className="w-full px-4 py-3 bg-[#f8faf9] border border-stone-200 rounded-xl focus:border-[#206c3b] outline-none text-sm font-light transition-all"
                    >
                      <option value={1500}>Menos de $2,000 MXN</option>
                      <option value={3500}>$2,000 - $5,000 MXN</option>
                      <option value={7500}>$5,000 - $10,000 MXN</option>
                      <option value={15000}>Más de $10,000 MXN (Tarifa Comercial o DAC)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-600 mb-2.5 uppercase tracking-wider">
                      ¿Por dónde prefieres que te contactemos?
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, contactMethod: 'whatsapp' })}
                        className={`py-3 px-4 rounded-xl border flex flex-col sm:flex-row items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                          formData.contactMethod === 'whatsapp'
                            ? 'bg-[#206c3b] text-white border-[#206c3b]'
                            : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        <MessageSquare className="w-4 h-4" />
                        WhatsApp
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, contactMethod: 'phone' })}
                        className={`py-3 px-4 rounded-xl border flex flex-col sm:flex-row items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                          formData.contactMethod === 'phone'
                            ? 'bg-[#206c3b] text-white border-[#206c3b]'
                            : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        <Phone className="w-4 h-4" />
                        Llamada
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, contactMethod: 'email' })}
                        className={`py-3 px-4 rounded-xl border flex flex-col sm:flex-row items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                          formData.contactMethod === 'email'
                            ? 'bg-[#206c3b] text-white border-[#206c3b]'
                            : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        <Mail className="w-4 h-4" />
                        Email
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-[#f5b301] hover:bg-[#e0a300] text-[#191c1c] active:scale-[0.99] font-bold text-sm tracking-wide py-4 px-6 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <span className="w-5 h-5 border-2 border-stone-800 border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <>
                        Solicitar Estudio Sin Costo
                        <ChevronRight className="w-4 h-4 text-stone-800" />
                      </>
                    )}
                  </button>
                </form>

                {errorMsg && (
                  <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100">
                    {errorMsg}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
