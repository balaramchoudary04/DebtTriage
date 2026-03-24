import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { useDebts } from '../../src/DebtContext';
import { generateLetter } from '../../src/calculations';
import { useTheme, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '../../src/theme';

type LetterType = 'dispute' | 'hardship' | 'goodwill';

const LETTER_DESCRIPTIONS: Record<LetterType, string> = {
  dispute: 'Request removal of inaccurate information from your credit report under the FCRA.',
  hardship: 'Request reduced payments or interest rates due to financial difficulty.',
  goodwill: 'Request removal of a late payment mark from a creditor as a goodwill gesture.',
};

export default function LettersScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { debts } = useDebts();

  const [letterType, setLetterType] = useState<LetterType>('dispute');
  const [form, setForm] = useState({
    name: '',
    address: '',
    accountNumber: '',
    creditorName: '',
    creditorAddress: '',
    details: '',
    amount: '',
  });
  const [generatedLetter, setGeneratedLetter] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showDebtPicker, setShowDebtPicker] = useState(false);

  const styles = makeStyles(colors);

  const setField = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleGenerate = () => {
    if (!form.name.trim() || !form.creditorName.trim()) {
      Alert.alert('Missing Fields', 'Please fill in your name and the creditor name at minimum.');
      return;
    }
    const letter = generateLetter(letterType, {
      name: form.name,
      address: form.address || '[Your Address]',
      accountNumber: form.accountNumber || '[Account Number]',
      creditorName: form.creditorName,
      creditorAddress: form.creditorAddress || '[Creditor Address]',
      details: form.details || '[Describe your situation here]',
      amount: form.amount || undefined,
    });
    setGeneratedLetter(letter);
    setShowPreview(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(generatedLetter);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied', 'Letter copied to clipboard.');
  };

  const handleShare = async () => {
    try {
      const filename = `${letterType}-letter-${Date.now()}.txt`;
      const uri = FileSystem.documentDirectory + filename;
      await FileSystem.writeAsStringAsync(uri, generatedLetter);
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, { mimeType: 'text/plain', dialogTitle: 'Share Letter' });
      } else {
        Alert.alert('Share not available', 'Sharing is not available on this device.');
      }
    } catch (err) {
      Alert.alert('Error', 'Could not share the letter.');
    }
  };

  const handleQuickFill = (debtId: number) => {
    const debt = debts.find((d) => d.id === debtId);
    if (!debt) return;
    setField('creditorName', debt.lender || debt.name);
    setField('accountNumber', debt.accountLast4 ? `****${debt.accountLast4}` : '');
    setField('amount', String(Math.round(debt.balance)));
    setShowDebtPicker(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Letter Generator</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Segment Control */}
          <View style={[styles.segmentRow, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
            {(['dispute', 'hardship', 'goodwill'] as LetterType[]).map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.segment, letterType === type && { backgroundColor: colors.primary }]}
                onPress={() => setLetterType(type)}
              >
                <Text style={[styles.segmentText, { color: letterType === type ? '#fff' : colors.textMuted }]}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Description */}
          <View style={[styles.descBox, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.descText, { color: colors.primary }]}>
              {LETTER_DESCRIPTIONS[letterType]}
            </Text>
          </View>

          {/* Quick Fill */}
          {debts.length > 0 && (
            <TouchableOpacity
              style={[styles.quickFillBtn, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}
              onPress={() => setShowDebtPicker(true)}
            >
              <Text style={[styles.quickFillText, { color: colors.primary }]}>
                ⚡ Quick-fill from saved debt
              </Text>
            </TouchableOpacity>
          )}

          {/* Form */}
          <View style={[styles.formCard, Shadow.sm]}>
            <FormField label="Your Full Name *" colors={colors}>
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                value={form.name}
                onChangeText={(v) => setField('name', v)}
                placeholder="Jane Smith"
                placeholderTextColor={colors.textMuted}
              />
            </FormField>

            <FormField label="Your Address" colors={colors}>
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                value={form.address}
                onChangeText={(v) => setField('address', v)}
                placeholder="123 Main St, City, State 12345"
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={2}
              />
            </FormField>

            <FormField label="Creditor / Institution *" colors={colors}>
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                value={form.creditorName}
                onChangeText={(v) => setField('creditorName', v)}
                placeholder="Chase Bank"
                placeholderTextColor={colors.textMuted}
              />
            </FormField>

            <FormField label="Creditor Address" colors={colors}>
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                value={form.creditorAddress}
                onChangeText={(v) => setField('creditorAddress', v)}
                placeholder="P.O. Box 1234, City, State 12345"
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={2}
              />
            </FormField>

            <FormField label="Account Number / Last 4" colors={colors}>
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                value={form.accountNumber}
                onChangeText={(v) => setField('accountNumber', v)}
                placeholder="****1234"
                placeholderTextColor={colors.textMuted}
              />
            </FormField>

            {letterType === 'hardship' && (
              <FormField label="Current Balance ($)" colors={colors}>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                  value={form.amount}
                  onChangeText={(v) => setField('amount', v)}
                  placeholder="5000"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                />
              </FormField>
            )}

            <FormField
              label={
                letterType === 'dispute'
                  ? 'Details of Dispute'
                  : letterType === 'hardship'
                  ? 'Description of Hardship'
                  : 'Reason for Late Payment'
              }
              colors={colors}
            >
              <TextInput
                style={[styles.textArea, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                value={form.details}
                onChangeText={(v) => setField('details', v)}
                placeholder={
                  letterType === 'dispute'
                    ? 'Describe the inaccurate information and why it should be corrected...'
                    : letterType === 'hardship'
                    ? 'Describe your financial hardship (job loss, medical emergency, etc.)...'
                    : 'Explain the circumstances that caused the late payment...'
                }
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
            </FormField>
          </View>

          {/* Generate Button */}
          <TouchableOpacity style={[styles.generateBtn, { backgroundColor: colors.primary }]} onPress={handleGenerate}>
            <Text style={styles.generateBtnText}>Generate Letter</Text>
          </TouchableOpacity>

          {/* Generated Letter Preview */}
          {generatedLetter !== '' && !showPreview && (
            <TouchableOpacity
              style={[styles.previewBanner, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
              onPress={() => setShowPreview(true)}
            >
              <Text style={[styles.previewBannerText, { color: colors.primary }]}>
                ✉️ Letter ready — tap to view
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Preview Modal */}
      <Modal
        visible={showPreview}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPreview(false)}
      >
        <View style={[styles.previewModal, { backgroundColor: colors.background }]}>
          <View style={[styles.previewHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowPreview(false)}>
              <Text style={[styles.previewClose, { color: colors.primary }]}>Done</Text>
            </TouchableOpacity>
            <Text style={[styles.previewTitle, { color: colors.text }]}>
              {letterType.charAt(0).toUpperCase() + letterType.slice(1)} Letter
            </Text>
            <View style={styles.previewActions}>
              <TouchableOpacity onPress={handleCopy} style={styles.previewActionBtn}>
                <Text style={[styles.previewActionText, { color: colors.primary }]}>Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleShare} style={styles.previewActionBtn}>
                <Text style={[styles.previewActionText, { color: colors.primary }]}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView
            contentContainerStyle={styles.previewContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.letterPaper, { backgroundColor: colors.card }, Shadow.sm]}>
              <Text style={[styles.letterText, { color: colors.text }]}>{generatedLetter}</Text>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Debt Picker Modal */}
      <Modal
        visible={showDebtPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDebtPicker(false)}
      >
        <Pressable style={styles.pickerOverlay} onPress={() => setShowDebtPicker(false)}>
          <View style={[styles.pickerSheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.pickerTitle, { color: colors.text }]}>Select Debt</Text>
            {debts.map((debt) => (
              <TouchableOpacity
                key={debt.id}
                style={[styles.pickerOption, { borderBottomColor: colors.border }]}
                onPress={() => handleQuickFill(debt.id)}
              >
                <View>
                  <Text style={[styles.pickerOptionName, { color: colors.text }]}>{debt.name}</Text>
                  <Text style={[styles.pickerOptionSub, { color: colors.textMuted }]}>
                    {debt.lender || 'No lender'} · {debt.accountLast4 ? `····${debt.accountLast4}` : 'No account #'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function FormField({ label, children, colors }: { label: string; children: React.ReactNode; colors: any }) {
  return (
    <View style={{ marginBottom: Spacing.lg }}>
      <Text style={{ fontSize: FontSize.sm, color: colors.textMuted, fontWeight: FontWeight.medium, marginBottom: Spacing.xs }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    screenHeader: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    screenTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.text },
    content: { padding: Spacing.lg },
    segmentRow: {
      flexDirection: 'row',
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      padding: 3,
      marginBottom: Spacing.md,
    },
    segment: {
      flex: 1,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.sm,
      alignItems: 'center',
    },
    segmentText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
    descBox: {
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    descText: { fontSize: FontSize.sm, lineHeight: 20 },
    quickFillBtn: {
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      padding: Spacing.md,
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    quickFillText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
    formCard: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    input: {
      borderWidth: 1,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      fontSize: FontSize.base,
    },
    textArea: {
      borderWidth: 1,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      fontSize: FontSize.sm,
      minHeight: 100,
    },
    generateBtn: {
      borderRadius: BorderRadius.md,
      padding: Spacing.lg,
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    generateBtnText: { color: '#fff', fontSize: FontSize.lg, fontWeight: FontWeight.bold },
    previewBanner: {
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      padding: Spacing.md,
      alignItems: 'center',
    },
    previewBannerText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
    previewModal: { flex: 1 },
    previewHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: Spacing.lg,
      borderBottomWidth: 1,
    },
    previewClose: { fontSize: FontSize.base },
    previewTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
    previewActions: { flexDirection: 'row', gap: Spacing.md },
    previewActionBtn: {},
    previewActionText: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
    previewContent: { padding: Spacing.lg, paddingBottom: 100 },
    letterPaper: {
      borderRadius: BorderRadius.md,
      padding: Spacing.xl,
    },
    letterText: { fontSize: FontSize.sm, lineHeight: 22, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
    pickerOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    pickerSheet: {
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      padding: Spacing.xl,
      maxHeight: '70%',
    },
    pickerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, marginBottom: Spacing.lg, textAlign: 'center' },
    pickerOption: {
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
    },
    pickerOptionName: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
    pickerOptionSub: { fontSize: FontSize.sm, marginTop: 2 },
  });
}
