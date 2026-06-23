export interface LeadData {
  name: string;
  email: string;
  phone: string;
  state: string;
  monthlyBill: number;
  contactMethod: 'whatsapp' | 'email' | 'phone';
}

export interface SolarCalculationResult {
  monthlyBill: number;
  recommendedPanels: number;
  systemSizekW: number;
  estimatedCost: number;
  annualSavings: number;
  paybackYears: number;
  environmentalImpactCo2: number; // in tons/year
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}
