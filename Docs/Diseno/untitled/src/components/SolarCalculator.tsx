import React, { useState } from 'react';
import { SolarCalculationResult } from '../types';
import { Sparkles, Sun, DollarSign, BatteryCharging, Zap, ShieldCheck } from 'lucide-react';

export default function SolarCalculator() {
  const [monthlyBill, setMonthlyBill] = useState<string>('3500');
  const [state, setState] = useState<string>('Ciudad de México');
  const [result, setResult] = useState<SolarCalculationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/calculate-savings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthlyBill: Number(monthlyBill), state }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Ocurrió un error al calcular.');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Error de conexión.');
    } finally {
      setLoading(false);
    }
  };

  const formattedCurrency = (val: number) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div id="calculadora" className="py-20 bg-[#f2f4f3] border-y border-stone-200">
      <div className="max-w-7xl mx-auto px-6 sm:px-12">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-[#206c3b]">Retorno de Inversión Garantizado</span>
          <h2 className="text-4xl font-extrabold text-[#002612] tracking-tight mt-3">
            Simulador de Ahorro Solar Inteligente
          </h2>
          <p className="text-lg text-stone-600 mt-4 leading-relaxed font-light">
            Descubre cuántos paneles necesita tu propiedad en México, el costo aproximado del sistema y cuándo recuperarás al 100% tu inversión.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Input Form Column */}
          <div className="lg:col-span-5 bg-white rounded-2xl p-8 shadow-sm border border-stone-200/60 transition-all duration-300">
            <h3 className="text-xl font-bold text-[#002612] flex items-center gap-2 mb-6">
              <Sun className="text-[#F5B301] w-5 h-5 animate-pulse-soft" />
              Tus datos de consumo
            </h3>

            <form onSubmit={handleCalculate} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-2">
                  ¿Cuál es tu estado residencial?
                </label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#f8faf9] border border-stone-200 focus:border-[#206c3b] focus:ring-1 focus:ring-[#206c3b] outline-none transition-all text-sm text-[#191c1c]"
                >
                  <option value="Ciudad de México">Ciudad de México</option>
                  <option value="Estado de México">Estado de México</option>
                  <option value="Nuevo León">Nuevo León (Monterrey)</option>
                  <option value="Jalisco">Jalisco (Guadalajara)</option>
                  <option value="Querétaro">Querétaro</option>
                  <option value="Guanajuato">Guanajuato</option>
                  <option value="Sonora">Sonora (Alta radiación)</option>
                  <option value="Quintana Roo">Quintana Roo (Cozumel / Cancún)</option>
                  <option value="Baja California">Baja California</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-2">
                  Monto aproximado de tu recibo de CFE ($ MXN)
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-stone-400 text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    value={monthlyBill}
                    onChange={(e) => setMonthlyBill(e.target.value)}
                    placeholder="Ej. 3500"
                    min="100"
                    required
                    className="block w-full pl-8 pr-28 py-3.5 rounded-xl border border-stone-200 bg-[#f8faf9] text-[#191c1c] placeholder-stone-400 focus:border-[#206c3b] focus:ring-1 focus:ring-[#206c3b] outline-none transition-all text-sm font-medium"
                  />
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <span className="text-stone-400 text-xs font-semibold uppercase">Bimestral</span>
                  </div>
                </div>
                <p className="text-xs text-stone-500 mt-2">
                  *Un recibo bimestral mayor a $3,000 MXN califica en tarifa de alto consumo (DAC). ¡Los paneles son ideales para ti!
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#f5b301] hover:bg-[#e0a300] text-[#191c1c] active:scale-[0.98] font-bold text-sm tracking-wide py-4 px-6 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-stone-800 border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-stone-800" />
                    Calcular Ahorro Real
                  </>
                )}
              </button>
            </form>

            {error && (
              <div className="mt-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100">
                {error}
              </div>
            )}
          </div>

          {/* Results Column */}
          <div className="lg:col-span-7">
            {result ? (
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-stone-200/60 relative overflow-hidden transition-all duration-500">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#206c3b]/5 rounded-bl-full pointer-events-none"></div>
                
                <h3 className="text-2xl font-extrabold text-[#002612] tracking-tight mb-8">
                  Tu Propuesta Técnica Preliminar
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-[#f8faf9] p-5 rounded-xl border border-stone-100 flex items-start gap-4">
                    <div className="p-3 bg-[#a4f1b4]/30 rounded-lg text-[#206c3b]">
                      <Zap className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="block text-xs uppercase tracking-widest text-[#206c3b] font-bold">Paneles Necesarios</span>
                      <strong className="text-3xl font-extrabold text-[#191c1c] block mt-1">{result.recommendedPanels} <span className="text-base font-normal text-stone-500">unids</span></strong>
                      <span className="text-xs text-stone-500 font-light block mt-0.5">Potencia total: {result.systemSizekW} kW</span>
                    </div>
                  </div>

                  <div className="bg-[#f8faf9] p-5 rounded-xl border border-stone-100 flex items-start gap-4">
                    <div className="p-3 bg-[#ffdea5]/40 rounded-lg text-[#2c1d00]">
                      <DollarSign className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="block text-xs uppercase tracking-widest text-orange-800 font-bold">Inversión Estimada</span>
                      <strong className="text-3xl font-extrabold text-[#191c1c ] block mt-1">{formattedCurrency(result.estimatedCost)}</strong>
                      <span className="text-xs text-stone-500 font-light block mt-0.5">*Precios con instalación premium</span>
                    </div>
                  </div>

                  <div className="bg-[#f8faf9] p-5 rounded-xl border border-stone-100 flex items-start gap-4">
                    <div className="p-3 bg-[#a4f1b4]/30 rounded-lg text-[#206c3b]">
                      <BatteryCharging className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="block text-xs uppercase tracking-widest text-[#206c3b] font-bold">Ahorro Anual Recurrente</span>
                      <strong className="text-3xl font-extrabold text-[#206c3b] block mt-1">{formattedCurrency(result.annualSavings)}</strong>
                      <span className="text-xs text-stone-500 font-light block mt-0.5">Pago mínimo de CFE: ~$120 MXN</span>
                    </div>
                  </div>

                  <div className="bg-[#f8faf9] p-5 rounded-xl border border-stone-100 flex items-start gap-4">
                    <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="block text-xs uppercase tracking-widest text-blue-800 font-bold">Retorno de Inversión</span>
                      <strong className="text-3xl font-extrabold text-[#191c1c] block mt-1">{result.paybackYears} <span className="text-base font-normal text-stone-500">años</span></strong>
                      <span className="text-xs text-stone-500 font-light block mt-0.5">Y más de 20 años de ganancia</span>
                    </div>
                  </div>
                </div>

                {/* Eco footprint banner */}
                <div className="bg-[#0f3d24] text-[#ffffff] rounded-xl p-5 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
                  <div>
                    <h4 className="font-bold text-sm text-[#a2d2af]">Tu aporte al medio ambiente</h4>
                    <p className="text-xs opacity-90 font-light mt-1 max-w-md">
                      Al instalar estos paneles, dejas de emitir cerca de <strong>{result.environmentalImpactCo2} toneladas de CO2</strong> al año en {state}, equivalente a plantar 28 árboles anualmente.
                    </p>
                  </div>
                  <div className="text-right whitespace-nowrap bg-[#206c3b] px-4 py-2 rounded-xl text-xs font-bold text-white uppercase tracking-widest">
                    Beneficio Ecológico 🌲
                  </div>
                </div>

                <div className="text-stone-600 text-xs font-light text-center">
                  *Esta es una estimación arquitectónico-técnica de Jygasoft. Para una propuesta formal, requerimos analizar tu historial de consumo descargando tu XML de CFE.
                </div>
              </div>
            ) : (
              <div className="bg-white/80 border border-stone-200/60 rounded-2xl h-full min-h-[380px] p-8 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center text-stone-400 mb-6 group-hover:scale-110 transition-transform">
                  <Sun className="w-10 h-10 text-[#206c3b] animate-spin" style={{ animationDuration: '20s' }} />
                </div>
                <h4 className="text-xl font-bold text-[#002612]">Esperando tus datos</h4>
                <p className="text-sm text-stone-500 max-w-sm mt-3">
                  Introduce tu consumo promedio de CFE a la izquierda para ver tu propuesta instantánea de paneles solares y métricas financieras de retorno.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
