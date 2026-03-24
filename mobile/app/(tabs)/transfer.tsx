import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDebts } from '../../src/DebtContext';
import {
  screenBalanceTransfers,
  screenConsolidation,
  formatCurrency,
  formatPercent,
  formatMonths,
} from '../../src/calculations';
import { useTheme, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '../../src/theme';
import type { BalanceTransferOption, ConsolidationOption } from '../../src/types';

type TabKey = 'transfer' | 'consolidation';

export default function TransferScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { debts, loading } = useDebts();
  const [activeTab, setActiveTab] = useState<TabKey>('transfer');

  const styles = makeStyles(colors);

  const data = useMemo(() => {
    const ccDebts = debts.filter((d) => d.type === 'credit_card');
    const ccBalance = ccDebts.reduce((s, d) => s + d.balance, 0);
    const totalBalance = debts.reduce((s, d) => s + d.balance, 0);
    const transfers = screenBalanceTransfers(ccDebts);
    const consolidations = screenConsolidation(debts);
    const bestSavings = Math.max(
      transfers.length > 0 ? transfers[0].estimatedSavings : 0,
      consolidations.length > 0 ? consolidations[0].savings : 0
    );
    return { ccBalance, totalBalance, transfers, consolidations, bestSavings };
  }, [debts]);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.screenHeader}>
          <Text style={styles.screenTitle}>Transfer & Consolidation</Text>
        </View>
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>🔄</Text>
          <Text style={styles.emptyTitle}>No debts to analyze</Text>
          <Text style={styles.emptyBody}>Add debts on the My Debts tab first.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Transfer & Consolidation</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {debts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔄</Text>
            <Text style={styles.emptyTitle}>No debts added</Text>
            <Text style={styles.emptyBody}>Add your debts to see savings opportunities.</Text>
          </View>
        ) : (
          <>
            {/* Summary Cards */}
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, Shadow.sm]}>
                <Text style={styles.summaryLabel}>CC Balance</Text>
                <Text style={[styles.summaryValue, { color: colors.destructive, fontVariant: ['tabular-nums'] }]}>
                  {formatCurrency(data.ccBalance)}
                </Text>
              </View>
              <View style={[styles.summaryCard, Shadow.sm]}>
                <Text style={styles.summaryLabel}>Total Debts</Text>
                <Text style={[styles.summaryValue, { color: colors.text, fontVariant: ['tabular-nums'] }]}>
                  {formatCurrency(data.totalBalance)}
                </Text>
              </View>
              <View style={[styles.summaryCard, Shadow.sm]}>
                <Text style={styles.summaryLabel}>Best Savings</Text>
                <Text style={[styles.summaryValue, { color: colors.success, fontVariant: ['tabular-nums'] }]}>
                  {formatCurrency(data.bestSavings)}
                </Text>
              </View>
            </View>

            {/* Segment Control */}
            <View style={[styles.segmentRow, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.segment, activeTab === 'transfer' && { backgroundColor: colors.primary }]}
                onPress={() => setActiveTab('transfer')}
              >
                <Text style={[styles.segmentText, { color: activeTab === 'transfer' ? '#fff' : colors.textMuted }]}>
                  Balance Transfer
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segment, activeTab === 'consolidation' && { backgroundColor: colors.primary }]}
                onPress={() => setActiveTab('consolidation')}
              >
                <Text style={[styles.segmentText, { color: activeTab === 'consolidation' ? '#fff' : colors.textMuted }]}>
                  Loan Consolidation
                </Text>
              </TouchableOpacity>
            </View>

            {activeTab === 'transfer' && (
              <>
                <View style={[styles.infoBox, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
                  <Text style={[styles.infoTitle, { color: colors.primary }]}>How Balance Transfers Work</Text>
                  <Text style={[styles.infoBody, { color: colors.textMuted }]}>
                    Move your high-interest credit card debt to a new card with a 0% intro APR. You pay a small transfer fee (typically 3%) but save on interest during the intro period. Goal: pay off the balance before the promo period ends.
                  </Text>
                </View>

                {data.transfers.length === 0 ? (
                  <View style={[styles.emptyOptions, { backgroundColor: colors.card }, Shadow.sm]}>
                    <Text style={[styles.emptyOptionsText, { color: colors.textMuted }]}>
                      No balance transfer options found. You may need higher-APR credit card debt for savings to apply.
                    </Text>
                  </View>
                ) : (
                  data.transfers.map((offer, i) => (
                    <TransferCard key={i} offer={offer} colors={colors} />
                  ))
                )}
              </>
            )}

            {activeTab === 'consolidation' && (
              <>
                <View style={[styles.infoBox, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
                  <Text style={[styles.infoTitle, { color: colors.primary }]}>How Loan Consolidation Works</Text>
                  <Text style={[styles.infoBody, { color: colors.textMuted }]}>
                    Combine multiple debts into a single personal loan with a lower APR. Simplifies payments, lowers interest, and gives you a fixed payoff date. Requires a good credit score (typically 650+).
                  </Text>
                </View>

                {data.consolidations.length === 0 ? (
                  <View style={[styles.emptyOptions, { backgroundColor: colors.card }, Shadow.sm]}>
                    <Text style={[styles.emptyOptionsText, { color: colors.textMuted }]}>
                      No consolidation options found. This usually means your current weighted APR is already lower than available loan rates, or you have fewer than 2 debts.
                    </Text>
                  </View>
                ) : (
                  data.consolidations.slice(0, 6).map((option, i) => (
                    <ConsolidationCard key={i} option={option} colors={colors} />
                  ))
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function TransferCard({ offer, colors }: { offer: BalanceTransferOption; colors: any }) {
  return (
    <View style={[tcStyles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}>
      <View style={tcStyles.cardHeader}>
        <Text style={[tcStyles.cardName, { color: colors.text }]}>{offer.name}</Text>
        <View style={[tcStyles.badge, { backgroundColor: colors.primaryLight }]}>
          <Text style={[tcStyles.badgeText, { color: colors.primary }]}>
            Save {formatCurrency(offer.estimatedSavings)}
          </Text>
        </View>
      </View>
      <View style={tcStyles.statsRow}>
        <View style={tcStyles.stat}>
          <Text style={[tcStyles.statLabel, { color: colors.textMuted }]}>Intro APR</Text>
          <Text style={[tcStyles.statValue, { color: colors.success }]}>0% for {offer.introPeriodMonths}mo</Text>
        </View>
        <View style={tcStyles.stat}>
          <Text style={[tcStyles.statLabel, { color: colors.textMuted }]}>Transfer Fee</Text>
          <Text style={[tcStyles.statValue, { color: colors.text }]}>{offer.transferFee}%</Text>
        </View>
        <View style={tcStyles.stat}>
          <Text style={[tcStyles.statLabel, { color: colors.textMuted }]}>Regular APR</Text>
          <Text style={[tcStyles.statValue, { color: colors.text }]}>{formatPercent(offer.regularApr)}</Text>
        </View>
      </View>
      <View style={[tcStyles.bottomRow, { borderTopColor: colors.border }]}>
        <Text style={[tcStyles.bottomText, { color: colors.textMuted }]}>
          Monthly target: {formatCurrency(offer.monthlyPayment)} · Total cost: {formatCurrency(offer.totalCost)}
        </Text>
      </View>
    </View>
  );
}

function ConsolidationCard({ option, colors }: { option: ConsolidationOption; colors: any }) {
  return (
    <View style={[tcStyles.card, { backgroundColor: colors.card, borderColor: colors.border }, Shadow.sm]}>
      <View style={tcStyles.cardHeader}>
        <Text style={[tcStyles.cardName, { color: colors.text }]}>{option.name}</Text>
        <View style={[tcStyles.badge, { backgroundColor: colors.primaryLight }]}>
          <Text style={[tcStyles.badgeText, { color: colors.primary }]}>
            Save {formatCurrency(option.savings)}
          </Text>
        </View>
      </View>
      <View style={tcStyles.statsRow}>
        <View style={tcStyles.stat}>
          <Text style={[tcStyles.statLabel, { color: colors.textMuted }]}>APR</Text>
          <Text style={[tcStyles.statValue, { color: colors.primary }]}>{formatPercent(option.apr)}</Text>
        </View>
        <View style={tcStyles.stat}>
          <Text style={[tcStyles.statLabel, { color: colors.textMuted }]}>Term</Text>
          <Text style={[tcStyles.statValue, { color: colors.text }]}>{formatMonths(option.termMonths)}</Text>
        </View>
        <View style={tcStyles.stat}>
          <Text style={[tcStyles.statLabel, { color: colors.textMuted }]}>Monthly</Text>
          <Text style={[tcStyles.statValue, { color: colors.text, fontVariant: ['tabular-nums'] }]}>
            {formatCurrency(option.monthlyPayment)}
          </Text>
        </View>
      </View>
      <View style={[tcStyles.bottomRow, { borderTopColor: colors.border }]}>
        <Text style={[tcStyles.bottomText, { color: colors.textMuted }]}>
          Total interest: {formatCurrency(option.totalInterest)} · Total paid: {formatCurrency(option.totalPaid)}
        </Text>
      </View>
    </View>
  );
}

const tcStyles = StyleSheet.create({
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
    marginBottom: Spacing.md,
  },
  cardName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, flex: 1, marginRight: Spacing.sm },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  badgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  statsRow: { flexDirection: 'row', marginBottom: Spacing.sm },
  stat: { flex: 1 },
  statLabel: { fontSize: FontSize.xs },
  statValue: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, marginTop: 2 },
  bottomRow: {
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    marginTop: Spacing.xs,
  },
  bottomText: { fontSize: FontSize.xs },
});

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    screenHeader: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    screenTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.text },
    content: { padding: Spacing.lg },
    emptyState: { alignItems: 'center', paddingTop: 60 },
    emptyIcon: { fontSize: 48, marginBottom: Spacing.lg },
    emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.text, marginBottom: Spacing.sm },
    emptyBody: { fontSize: FontSize.base, color: colors.textMuted, textAlign: 'center' },
    summaryRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
    summaryCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
    },
    summaryLabel: { fontSize: FontSize.xs, color: colors.textMuted, marginBottom: 4 },
    summaryValue: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: colors.text },
    segmentRow: {
      flexDirection: 'row',
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      padding: 3,
      marginBottom: Spacing.lg,
    },
    segment: {
      flex: 1,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.sm,
      alignItems: 'center',
    },
    segmentText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
    infoBox: {
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      padding: Spacing.md,
      marginBottom: Spacing.lg,
    },
    infoTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginBottom: 4 },
    infoBody: { fontSize: FontSize.xs, lineHeight: 18 },
    emptyOptions: {
      borderRadius: BorderRadius.md,
      padding: Spacing.xl,
      alignItems: 'center',
    },
    emptyOptionsText: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
  });
}
