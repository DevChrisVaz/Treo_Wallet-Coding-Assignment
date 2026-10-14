import type { Account } from '@devchrisvaz/wallet-contract';
import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';

import { ReceiveSheetView } from './receive-sheet-view';

/**
 * Hoja "Recibir dinero" (MOB-28): conecta la vista con el portapapeles (expo-clipboard) y con la hoja
 * nativa de compartir (`Share` de React Native). La vista no importa módulos nativos.
 */
export function ReceiveSheet({
  open,
  onClose,
  holder,
  accounts,
  selectedId,
}: {
  open: boolean;
  onClose: () => void;
  holder: string;
  accounts: readonly Account[];
  selectedId: string | undefined;
}) {
  return (
    <ReceiveSheetView
      open={open}
      onClose={onClose}
      holder={holder}
      accounts={accounts}
      selectedId={selectedId}
      onCopy={async (clabe) => {
        await Clipboard.setStringAsync(clabe);
      }}
      onShare={async (message) => {
        await Share.share({ message });
      }}
    />
  );
}
