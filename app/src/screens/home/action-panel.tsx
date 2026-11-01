import { Button, Column, Host, TextInput } from '@expo/ui';
import { useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Colors, MaxPanelWidth, Spacing } from '@/constants/theme';
import { useI18n } from '@/i18n';

export type PanelMode = 'browse' | 'placing' | 'live';

type Props = {
  mode: PanelMode;
  busy: boolean;
  message: string | null;
  /** Formatted local time the house expires, in `live` mode. */
  until?: string;
  onMark: () => void;
  onConfirm: (note: string) => void;
  onCancel: () => void;
  onEnd: () => void;
};

export function ActionPanel({ mode, busy, message, until, onMark, onConfirm, onCancel, onEnd }: Props) {
  const { t } = useI18n();
  const note = useRef('');

  return (
    <View style={styles.card}>
      {mode === 'placing' && (
        <>
          <Text style={styles.title}>{t.placingTitle}</Text>
          <Text style={styles.body}>{t.placingHint}</Text>
        </>
      )}
      {mode === 'live' && (
        <>
          <Text style={styles.title}>{t.liveTitle}</Text>
          {until && <Text style={styles.body}>{t.liveUntil(until)}</Text>}
        </>
      )}
      {message && <Text style={styles.message}>{message}</Text>}

      {busy ? (
        <ActivityIndicator color={Colors.pumpkin} style={styles.spinner} />
      ) : (
        <Host matchContents={{ vertical: true }} colorScheme="dark" seedColor={Colors.pumpkin} style={styles.host}>
          <Column spacing={Spacing.two} style={{ width: '100%' }}>
            {mode === 'browse' && <Button label={`🎃  ${t.markHouse}`} onPress={onMark} style={{ width: '100%' }} />}
            {mode === 'placing' && (
              <>
                <TextInput
                  style={{ width: '100%' }}
                  placeholder={t.notePlaceholder}
                  onChangeText={(text) => {
                    note.current = text;
                  }}
                  returnKeyType="done"
                />
                <Button label={t.confirmPlace} onPress={() => onConfirm(note.current)} style={{ width: '100%' }} />
                <Button label={t.cancel} variant="text" onPress={onCancel} style={{ width: '100%' }} />
              </>
            )}
            {mode === 'live' && <Button label={`🍬  ${t.endButton}`} onPress={onEnd} style={{ width: '100%' }} />}
          </Column>
        </Host>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: MaxPanelWidth,
    alignSelf: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 24,
    borderCurve: 'continuous',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
  },
  title: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  body: {
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 20,
  },
  message: {
    color: Colors.danger,
    fontSize: 15,
  },
  host: {
    width: '100%',
    marginTop: Spacing.one,
  },
  spinner: {
    height: 40,
    marginTop: Spacing.one,
  },
});
