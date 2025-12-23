import { Alert, Platform } from 'react-native';

type ConfirmOptions = {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
};

export async function confirmDestructive({
  title,
  message,
  confirmText = 'OK',
  cancelText = 'Annuler',
}: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    const confirmFn = (globalThis as any)?.confirm;
    if (typeof confirmFn === 'function') {
      return Boolean(confirmFn(`${title}\n\n${message}`));
    }
    return true;
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

type MessageOptions = {
  title: string;
  message?: string;
};

export function showMessage({ title, message = '' }: MessageOptions) {
  if (Platform.OS === 'web') {
    const alertFn = (globalThis as any)?.alert;
    if (typeof alertFn === 'function') {
      alertFn(message ? `${title}\n\n${message}` : title);
    }
    return;
  }

  Alert.alert(title, message);
}
