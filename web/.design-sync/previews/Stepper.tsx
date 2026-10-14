import { Stepper } from 'wallet-web-ui';

/* Indicador de pasos (WEB-30): una barra por paso y "Paso n de m · Etiqueta". */

export const Step1 = () => (
  <div className="max-w-sm">
    <Stepper current={1} total={5} label="Destinatario" />
  </div>
);

export const Step3 = () => (
  <div className="max-w-sm">
    <Stepper current={3} total={4} label="Revisión" />
  </div>
);

export const Last = () => (
  <div className="max-w-sm">
    <Stepper current={5} total={5} label="Comprobante" />
  </div>
);
