import type { Account } from '@devchrisvaz/wallet-contract';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BottomSheet, Button } from '@/components/ui';
import { theme } from '@/theme';

import { selectedAccount } from './selection';

/** Banco que aparece en los datos para recibir: la CLABE es de TreoWallet. */
export const RECEIVE_BANK = 'TreoWallet';

/** CLABE de 18 dígitos en grupos de 4 (el último de 2): `6461 8015 7000 0097 19`. */
export function groupClabe(clabe: string): string {
  return clabe.replace(/(\d{4})(?=\d)/g, '$1 ');
}

/** Texto que comparte "Compartir": los mismos datos que se ven en la hoja. */
export function receiveShareMessage(holder: string, account: Account): string {
  return [
    `Titular: ${holder}`,
    `Banco: ${RECEIVE_BANK}`,
    `Cuenta: ${account.name}`,
    `CLABE: ${account.clabe}`,
  ].join('\n');
}

export interface ReceiveSheetContentProps {
  holder: string;
  accounts: readonly Account[];
  account: Account;
  /** Ya se copió la CLABE de esta cuenta: la acción confirma "CLABE copiada". */
  copied: boolean;
  onSwitch: (accountId: string) => void;
  onCopy: () => void;
  onShare: () => void;
}

/**
 * Datos para recibir dinero (MOB-28, R29): selector de cuenta, Titular, Banco, Cuenta, CLABE completa
 * agrupada, "Copiar CLABE", "Compartir" y la nota. Es el contenido de la hoja "Recibir dinero".
 */
export function ReceiveSheetContent({
  holder,
  accounts,
  account,
  copied,
  onSwitch,
  onCopy,
  onShare,
}: ReceiveSheetContentProps) {
  const fields = [
    ['Titular', holder],
    ['Banco', RECEIVE_BANK],
    ['Cuenta', account.name],
  ] as const;
  return (
    <>
      {accounts.length > 1 ? (
        <View style={styles.switcher}>
          {accounts.map((item) => (
            <View key={item.id} style={styles.switchItem}>
              <Button
                label={item.name}
                variant={item.id === account.id ? 'primary' : 'secondary'}
                selected={item.id === account.id}
                onPress={() => onSwitch(item.id)}
              />
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.fields}>
        {fields.map(([label, value]) => (
          <View key={label} style={styles.field}>
            <Text style={styles.caption}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
          </View>
        ))}
        <View style={styles.field}>
          <Text style={styles.caption}>CLABE</Text>
          <Text selectable style={styles.clabe}>
            {groupClabe(account.clabe)}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Button
          label={copied ? 'CLABE copiada' : 'Copiar CLABE'}
          icon={copied ? 'success' : 'copy'}
          onPress={onCopy}
        />
        <Button label="Compartir" icon="share" variant="secondary" onPress={onShare} />
      </View>
      <Text style={styles.hint}>
        Comparte estos datos para que te transfieran desde otra cuenta TreoWallet.
      </Text>
    </>
  );
}

export interface ReceiveSheetViewProps {
  open: boolean;
  onClose: () => void;
  /** Titular: nombre completo de la persona de la sesión. */
  holder: string;
  accounts: readonly Account[];
  /** Cuenta elegida en Inicio: llega preseleccionada al abrir. */
  selectedId: string | undefined;
  /** Copia la CLABE (18 dígitos, sin espacios); el portapapeles lo pone el contenedor. */
  onCopy: (clabe: string) => Promise<void> | void;
  /** Abre la hoja nativa de compartir con el texto dado. */
  onShare: (message: string) => Promise<void> | void;
}

/** Hoja "Recibir dinero" de Inicio (MOB-28): `BottomSheet` con los datos de la cuenta elegida. */
export function ReceiveSheetView({
  open,
  onClose,
  holder,
  accounts,
  selectedId,
  onCopy,
  onShare,
}: ReceiveSheetViewProps) {
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // Cada apertura parte de la cuenta de Inicio y sin el aviso de copiado: al cerrar se olvidan.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) {
      setPickedId(null);
      setCopiedId(null);
    }
  }
  const account = selectedAccount(accounts, pickedId ?? selectedId ?? null);
  if (!account) return null;
  return (
    <BottomSheet open={open} onClose={onClose} title="Recibir dinero">
      <ReceiveSheetContent
        holder={holder}
        accounts={accounts}
        account={account}
        copied={copiedId === account.id}
        onSwitch={setPickedId}
        onCopy={() => {
          void Promise.resolve(onCopy(account.clabe)).then(() => setCopiedId(account.id));
        }}
        onShare={() => void onShare(receiveShareMessage(holder, account))}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  switcher: { flexDirection: 'row', gap: theme.spacing[2] },
  switchItem: { flex: 1 },
  fields: { gap: theme.spacing[3] },
  field: { gap: theme.spacing[1] },
  caption: { ...theme.typography.caption, color: theme.colors.text.secondary },
  value: { ...theme.typography.body, color: theme.colors.text.primary },
  clabe: { ...theme.typography.h3, ...theme.amount, color: theme.colors.text.primary },
  actions: { gap: theme.spacing[2] },
  hint: { ...theme.typography.bodySm, color: theme.colors.text.secondary },
});
