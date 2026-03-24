import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useDebts } from '../../src/DebtContext';
import { formatCurrency, formatPercent } from '../../src/calculations';
import {
  useTheme,
  FontSize,
  FontWeight,
  Spacing,
  BorderRadius,
  Shadow,
  DEBT_TYPE_LABELS,
  DEBT_TYPE_OPTIONS,
} from '../../src/theme';
import type { Debt, DebtInput } from '../../src/types';

const EMPTY_FORM: DebtInput = {
  name: '',
  type: 'credit_card',
  balance: 0,
  creditLimit: null,
  apr: 0,
  minimumPayment: 0,
  dueDay: 1,
  lender: null,
  accountLast4: null,
};

export default function DebtsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { debts, loading, addDebt, updateDebt, removeDebt } = useDebts();

  const [showModal, setShowModal] = useState(false);
  const [editDebt, setEditDebt] = useState<Debt | null>(null);
  const [form, setForm] = useState<DebtInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const styles = makeStyles(colors);

  const openAdd = useCallback(() => {
    setEditDebt(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const openEdit = useCallback((debt: Debt) => {
    setEditDebt(debt);
    setForm({
      name: debt.name,
      type: debt.type,
      balance: debt.balance,
      creditLimit: debt.creditLimit,
      apr: debt.apr,
      minimumPayment: debt.minimumPayment,
      dueDay: debt.dueDay,
      lender: debt.lender,
      accountLast4: debt.accountLast4,
    });
    setShowModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleDelete = useCallback(
    (debt: Debt) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert(
        'Delete Debt',
        `Are you sure you want to delete "${debt.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              await removeDebt(debt.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            },
          },
        ]
      );
    },
    [removeDebt]
  );

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) {
      Alert.alert('Validation', 'Please enter a debt name.');
      return;
    }
    if (form.balance <= 0) {
      Alert.alert('Validation', 'Balance must be greater than 0.');
      return;
    }
    setSaving(true);
    try {
      if (editDebt) {
        await updateDebt(editDebt.id, form);
      } else {
        await addDebt(form);
      }
      setShowModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert('Error', 'Failed to save debt. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [form, editDebt, addDebt, updateDebt]);

  const parsePastedStatement = useCallback(() => {
    const text = pasteText;
    // Extract balance
    const balanceMatch = text.match(/(?:balance|amount due|current balance)[:\s]*\$?([\d,]+\.?\d*)/i);
    const aprMatch = text.match(/(?:apr|interest rate|annual percentage rate)[:\s]*([\d.]+)%?/i);
    const minMatch = text.match(/(?:minimum payment|min(?:imum)? due)[:\s]*\$?([\d,]+\.?\d*)/i);
    const limitMatch = text.match(/(?:credit limit|credit line)[:\s]*\$?([\d,]+\.?\d*)/i);

    const newForm = { ...form };
    if (balanceMatch) newForm.balance = parseFloat(balanceMatch[1].replace(/,/g, ''));
    if (aprMatch) newForm.apr = parseFloat(aprMatch[1]);
    if (minMatch) newForm.minimumPayment = parseFloat(minMatch[1].replace(/,/g, ''));
    if (limitMatch) newForm.creditLimit = parseFloat(limitMatch[1].replace(/,/g, ''));

    setForm(newForm);
    setShowPasteModal(false);
    setPasteText('');
    Alert.alert(
      'Parsed',
      `Found: Balance ${balanceMatch ? '$' + balanceMatch[1] : 'not found'}, APR ${aprMatch ? aprMatch[1] + '%' : 'not found'}, Min ${minMatch ? '$' + minMatch[1] : 'not found'}`
    );
  }, [pasteText, form]);

  const setField = (key: keyof DebtInput, value: any) =>
    setForm((f) => ({ ...f, [key]: value }));

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>My Debts</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.pasteBtn}
            onPress={() => setShowPasteModal(true)}
          >
            <Text style={[styles.pasteBtnText, { color: colors.primary }]}>Paste Statement</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {debts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💳</Text>
            <Text style={styles.emptyTitle}>No debts added yet</Text>
            <Text style={styles.emptyBody}>Tap "+ Add" to add your first debt.</Text>
          </View>
        ) : (
          debts.map((debt) => (
            <DebtCard
              key={debt.id}
              debt={debt}
              colors={colors}
              onEdit={() => openEdit(debt)}
              onDelete={() => handleDelete(debt)}
            />
          ))
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <KeyboardAvoidingView
          style={[styles.modalContainer, { backgroundColor: colors.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={[styles.modalCancel, { color: colors.primary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editDebt ? 'Edit Debt' : 'Add Debt'}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={[styles.modalSave, { color: colors.primary }]}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false}>
            <FormField label="Debt Name *" colors={colors}>
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                value={form.name}
                onChangeText={(v) => setField('name', v)}
                placeholder="e.g. Chase Sapphire"
                placeholderTextColor={colors.textMuted}
              />
            </FormField>

            <FormField label="Type" colors={colors}>
              <TouchableOpacity
                style={[styles.picker, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                onPress={() => setShowTypePicker(true)}
              >
                <Text style={[styles.pickerValue, { color: colors.text }]}>
                  {DEBT_TYPE_LABELS[form.type]}
                </Text>
                <Text style={{ color: colors.textMuted }}>▾</Text>
              </TouchableOpacity>
            </FormField>

            <FormField label="Balance ($) *" colors={colors}>
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                value={form.balance > 0 ? String(form.balance) : ''}
                onChangeText={(v) => setField('balance', parseFloat(v) || 0)}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
              />
            </FormField>

            <FormField label="APR (%) *" colors={colors}>
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                value={form.apr > 0 ? String(form.apr) : ''}
                onChangeText={(v) => setField('apr', parseFloat(v) || 0)}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
              />
            </FormField>

            <FormField label="Minimum Payment ($) *" colors={colors}>
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                value={form.minimumPayment > 0 ? String(form.minimumPayment) : ''}
                onChangeText={(v) => setField('minimumPayment', parseFloat(v) || 0)}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
              />
            </FormField>

            <FormField label="Payment Due Day (1-31)" colors={colors}>
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                value={form.dueDay > 0 ? String(form.dueDay) : ''}
                onChangeText={(v) => setField('dueDay', parseInt(v) || 1)}
                placeholder="1"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
              />
            </FormField>

            {form.type === 'credit_card' && (
              <FormField label="Credit Limit ($)" colors={colors}>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                  value={form.creditLimit != null && form.creditLimit > 0 ? String(form.creditLimit) : ''}
                  onChangeText={(v) => setField('creditLimit', parseFloat(v) || null)}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                />
              </FormField>
            )}

            <FormField label="Lender / Institution" colors={colors}>
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                value={form.lender ?? ''}
                onChangeText={(v) => setField('lender', v || null)}
                placeholder="e.g. Chase Bank"
                placeholderTextColor={colors.textMuted}
              />
            </FormField>

            <FormField label="Account Last 4 Digits" colors={colors}>
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                value={form.accountLast4 ?? ''}
                onChangeText={(v) => setField('accountLast4', v || null)}
                placeholder="1234"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={4}
              />
            </FormField>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Type Picker Modal */}
      <Modal
        visible={showTypePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTypePicker(false)}
      >
        <Pressable style={styles.pickerOverlay} onPress={() => setShowTypePicker(false)}>
          <View style={[styles.pickerSheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.pickerTitle, { color: colors.text }]}>Select Type</Text>
            {DEBT_TYPE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.pickerOption, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setField('type', opt.value);
                  setShowTypePicker(false);
                }}
              >
                <Text style={[styles.pickerOptionText, { color: form.type === opt.value ? colors.primary : colors.text }]}>
                  {opt.label}
                </Text>
                {form.type === opt.value && (
                  <Text style={{ color: colors.primary }}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Paste Statement Modal */}
      <Modal
        visible={showPasteModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPasteModal(false)}
      >
        <KeyboardAvoidingView
          style={[styles.modalContainer, { backgroundColor: colors.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setShowPasteModal(false); setPasteText(''); }}>
              <Text style={[styles.modalCancel, { color: colors.primary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Paste Statement</Text>
            <TouchableOpacity onPress={parsePastedStatement}>
              <Text style={[styles.modalSave, { color: colors.primary }]}>Parse</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.formContent}>
            <Text style={[styles.pasteHint, { color: colors.textMuted }]}>
              Paste your credit card statement text below. We'll extract the balance, APR, minimum payment, and credit limit.
            </Text>
            <TextInput
              style={[styles.pasteInput, {
                color: colors.text,
                backgroundColor: colors.inputBackground,
                borderColor: colors.border,
              }]}
              value={pasteText}
              onChangeText={setPasteText}
              placeholder="Paste statement text here..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={12}
              textAlignVertical="top"
            />
          </View>
        </KeyboardAvoidingView>
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

function DebtCard({
  debt,
  colors,
  onEdit,
  onDelete,
}: {
  debt: Debt;
  colors: any;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isCC = debt.type === 'credit_card';
  const utilization = isCC && debt.creditLimit ? (debt.balance / debt.creditLimit) * 100 : 0;

  return (
    <View style={[cardStyles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}>
      <View style={cardStyles.cardHeader}>
        <View style={cardStyles.cardLeft}>
          <Text style={[cardStyles.cardName, { color: colors.text }]}>{debt.name}</Text>
          <Text style={[cardStyles.cardType, { color: colors.textMuted }]}>
            {DEBT_TYPE_LABELS[debt.type]}
            {debt.lender ? ` · ${debt.lender}` : ''}
            {debt.accountLast4 ? ` ···${debt.accountLast4}` : ''}
          </Text>
        </View>
        <View style={cardStyles.cardRight}>
          <Text style={[cardStyles.cardBalance, { color: colors.text, fontVariant: ['tabular-nums'] }]}>
            {formatCurrency(debt.balance)}
          </Text>
          <Text style={[cardStyles.cardApr, { color: debt.apr > 20 ? colors.destructive : colors.textMuted }]}>
            {formatPercent(debt.apr)} APR
          </Text>
        </View>
      </View>

      {isCC && debt.creditLimit != null && debt.creditLimit > 0 && (
        <View style={cardStyles.utilRow}>
          <View style={[cardStyles.utilBar, { backgroundColor: colors.border }]}>
            <View
              style={[
                cardStyles.utilFill,
                {
                  width: `${Math.min(utilization, 100)}%` as any,
                  backgroundColor: utilization > 30 ? colors.destructive : colors.success,
                },
              ]}
            />
          </View>
          <Text style={[cardStyles.utilText, { color: colors.textMuted }]}>
            {formatPercent(utilization)} used of {formatCurrency(debt.creditLimit)}
          </Text>
        </View>
      )}

      <View style={cardStyles.cardFooter}>
        <Text style={[cardStyles.minText, { color: colors.textMuted }]}>
          Min: {formatCurrency(debt.minimumPayment)}/mo · Due day {debt.dueDay}
        </Text>
        <View style={cardStyles.cardActions}>
          <TouchableOpacity onPress={onEdit} style={[cardStyles.actionBtn, { borderColor: colors.border }]}>
            <Text style={[cardStyles.actionBtnText, { color: colors.primary }]}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={[cardStyles.actionBtn, { borderColor: colors.destructive }]}>
            <Text style={[cardStyles.actionBtnText, { color: colors.destructive }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardLeft: { flex: 1 },
  cardRight: { alignItems: 'flex-end' },
  cardName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  cardType: { fontSize: FontSize.xs, marginTop: 2 },
  cardBalance: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  cardApr: { fontSize: FontSize.xs, marginTop: 2 },
  utilRow: { marginTop: Spacing.md },
  utilBar: {
    height: 6,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    marginBottom: 4,
  },
  utilFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  utilText: { fontSize: FontSize.xs },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E0',
  },
  minText: { fontSize: FontSize.xs, flex: 1 },
  cardActions: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  actionBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
});

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { justifyContent: 'center', alignItems: 'center' },
    screenHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    screenTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.text },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    pasteBtn: { paddingHorizontal: Spacing.sm },
    pasteBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
    addBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.md,
    },
    addBtnText: { color: '#fff', fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
    list: { padding: Spacing.lg },
    emptyState: { alignItems: 'center', paddingTop: 60 },
    emptyIcon: { fontSize: 48, marginBottom: Spacing.lg },
    emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.text, marginBottom: Spacing.sm },
    emptyBody: { fontSize: FontSize.base, color: colors.textMuted, textAlign: 'center' },
    modalContainer: { flex: 1 },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: Spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
    modalCancel: { fontSize: FontSize.base },
    modalSave: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
    formContent: { padding: Spacing.lg },
    input: {
      borderWidth: 1,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      fontSize: FontSize.base,
    },
    picker: {
      borderWidth: 1,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    pickerValue: { fontSize: FontSize.base },
    pickerOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    pickerSheet: {
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      padding: Spacing.xl,
    },
    pickerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, marginBottom: Spacing.lg, textAlign: 'center' },
    pickerOption: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
    },
    pickerOptionText: { fontSize: FontSize.base },
    pasteHint: { fontSize: FontSize.sm, marginBottom: Spacing.md, lineHeight: 20 },
    pasteInput: {
      borderWidth: 1,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      fontSize: FontSize.sm,
      minHeight: 200,
    },
  });
}
