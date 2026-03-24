import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useDebts } from '../../src/DebtContext';
import {
  calculatePayoffPlan,
  calculateUtilization,
  formatCurrency,
  formatPercent,
  formatMonths,
} from '../../src/calculations';
import { useTheme, FontSize, FontWeight, Spacing, BorderRadius, Shadow, DEBT_TYPE_LABELS } from '../../src/theme';

export default function DashboardScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { debts, loading } = useDebts();
  const router = useRouter();

  const stats = useMemo(() => {
    if (debts.length === 0) return null;
    const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
    const totalMin = debts.reduce((s, d) => s + d.minimumPayment, 0);
    const highestApr = Math.max(...debts.map((d) => d.apr));
    const util = calculateUtilization(debts);
    const avalanche = calculatePayoffPlan(debts, 'avalanche', 0);
    const snowball = calculatePayoffPlan(debts, 'snowball', 0);
    const interestSaved = snowball.totalInterestPaid - avalanche.totalInterestPaid;
    return { totalDebt, totalMin, highestApr, util, avalanche, snowball, interestSaved };
  }, [debts]);

  const styles = makeStyles(colors);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + 100 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>DebtTriage</Text>
        <Text style={styles.headerSub}>Your financial dashboard</Text>
      </View>

      {debts.length === 0 ? (
        /* Empty State */
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>💳</Text>
          <Text style={styles.emptyTitle}>Add your first debt</Text>
          <Text style={styles.emptyBody}>
            Track your debts, see payoff strategies, and improve your credit score.
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push('/(tabs)/debts')}
          >
            <Text style={styles.emptyButtonText}>Go to My Debts</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Alert Banners */}
          {stats && stats.highestApr > 20 && (
            <View style={[styles.alertBanner, { backgroundColor: '#FFF4E5', borderColor: '#F59E0B' }]}>
              <Text style={[styles.alertText, { color: '#92400E' }]}>
                ⚠️ You have debt with APR above 20%. Consider balance transfer options.
              </Text>
            </View>
          )}
          {stats && stats.util.overall > 30 && (
            <View style={[styles.alertBanner, { backgroundColor: '#FEF2F2', borderColor: '#EF4444' }]}>
              <Text style={[styles.alertText, { color: '#991B1B' }]}>
                🔴 Credit utilization at {formatPercent(stats.util.overall)} — above 30% hurts your score.
              </Text>
            </View>
          )}

          {/* KPI Cards */}
          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, Shadow.sm]}>
              <Text style={styles.kpiLabel}>Total Debt</Text>
              <Text style={[styles.kpiValue, { color: colors.destructive }]}>
                {formatCurrency(stats?.totalDebt ?? 0)}
              </Text>
            </View>
            <View style={[styles.kpiCard, Shadow.sm]}>
              <Text style={styles.kpiLabel}>Monthly Min</Text>
              <Text style={[styles.kpiValue, { color: colors.warning }]}>
                {formatCurrency(stats?.totalMin ?? 0)}
              </Text>
            </View>
          </View>
          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, Shadow.sm]}>
              <Text style={styles.kpiLabel}>Highest APR</Text>
              <Text style={[styles.kpiValue, { color: stats && stats.highestApr > 20 ? colors.destructive : colors.text }]}>
                {formatPercent(stats?.highestApr ?? 0)}
              </Text>
            </View>
            <View style={[styles.kpiCard, Shadow.sm]}>
              <Text style={styles.kpiLabel}>Utilization</Text>
              <Text style={[styles.kpiValue, { color: stats && stats.util.overall > 30 ? colors.destructive : colors.success }]}>
                {formatPercent(stats?.util.overall ?? 0)}
              </Text>
            </View>
          </View>

          {/* Avalanche Savings Banner */}
          {stats && stats.interestSaved > 0 && (
            <View style={[styles.savingsBanner, { backgroundColor: colors.primaryLight }]}>
              <Text style={[styles.savingsText, { color: colors.primary }]}>
                💡 Avalanche method saves {formatCurrency(stats.interestSaved)} vs Snowball
              </Text>
            </View>
          )}

          {/* Payoff Summary */}
          {stats && (
            <View style={[styles.summaryCard, Shadow.sm]}>
              <Text style={styles.sectionTitle}>Payoff Summary</Text>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Avalanche</Text>
                  <Text style={styles.summaryValue}>{formatMonths(stats.avalanche.payoffMonths)}</Text>
                  <Text style={styles.summarySub}>{formatCurrency(stats.avalanche.totalInterestPaid)} interest</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Snowball</Text>
                  <Text style={styles.summaryValue}>{formatMonths(stats.snowball.payoffMonths)}</Text>
                  <Text style={styles.summarySub}>{formatCurrency(stats.snowball.totalInterestPaid)} interest</Text>
                </View>
              </View>
            </View>
          )}

          {/* Debt Breakdown */}
          <Text style={styles.sectionHeader}>Debt Breakdown</Text>
          {debts.map((debt) => (
            <View key={debt.id} style={[styles.debtRow, Shadow.sm]}>
              <View style={styles.debtRowLeft}>
                <Text style={styles.debtRowName}>{debt.name}</Text>
                <Text style={styles.debtRowType}>{DEBT_TYPE_LABELS[debt.type]}</Text>
              </View>
              <View style={styles.debtRowRight}>
                <Text style={[styles.debtRowBalance, { fontVariant: ['tabular-nums'] }]}>
                  {formatCurrency(debt.balance)}
                </Text>
                <Text style={[styles.debtRowApr, { color: debt.apr > 20 ? colors.destructive : colors.textMuted }]}>
                  {formatPercent(debt.apr)} APR
                </Text>
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: Spacing.lg,
    },
    centered: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      color: colors.textMuted,
      fontSize: FontSize.base,
    },
    header: {
      marginBottom: Spacing.xl,
    },
    headerTitle: {
      fontSize: FontSize.xxxl,
      fontWeight: FontWeight.bold,
      color: colors.primary,
      letterSpacing: -0.5,
    },
    headerSub: {
      fontSize: FontSize.sm,
      color: colors.textMuted,
      marginTop: 2,
    },
    emptyCard: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.xxl,
      alignItems: 'center',
      ...Shadow.md,
      marginTop: Spacing.xl,
    },
    emptyIcon: {
      fontSize: 48,
      marginBottom: Spacing.lg,
    },
    emptyTitle: {
      fontSize: FontSize.xl,
      fontWeight: FontWeight.bold,
      color: colors.text,
      marginBottom: Spacing.sm,
    },
    emptyBody: {
      fontSize: FontSize.base,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: Spacing.xl,
    },
    emptyButton: {
      backgroundColor: colors.primary,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.xxl,
      borderRadius: BorderRadius.md,
    },
    emptyButtonText: {
      color: '#fff',
      fontSize: FontSize.base,
      fontWeight: FontWeight.semibold,
    },
    alertBanner: {
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
    },
    alertText: {
      fontSize: FontSize.sm,
      lineHeight: 20,
    },
    kpiRow: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginBottom: Spacing.md,
    },
    kpiCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
    },
    kpiLabel: {
      fontSize: FontSize.xs,
      color: colors.textMuted,
      fontWeight: FontWeight.medium,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: Spacing.xs,
    },
    kpiValue: {
      fontSize: FontSize.xxl,
      fontWeight: FontWeight.bold,
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    savingsBanner: {
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    savingsText: {
      fontSize: FontSize.sm,
      fontWeight: FontWeight.medium,
    },
    summaryCard: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.xl,
    },
    sectionTitle: {
      fontSize: FontSize.base,
      fontWeight: FontWeight.semibold,
      color: colors.text,
      marginBottom: Spacing.lg,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    summaryItem: {
      flex: 1,
      alignItems: 'center',
    },
    summaryLabel: {
      fontSize: FontSize.sm,
      color: colors.textMuted,
      marginBottom: Spacing.xs,
    },
    summaryValue: {
      fontSize: FontSize.xl,
      fontWeight: FontWeight.bold,
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    summarySub: {
      fontSize: FontSize.xs,
      color: colors.textMuted,
      marginTop: 2,
      fontVariant: ['tabular-nums'],
    },
    summaryDivider: {
      width: 1,
      height: 48,
      backgroundColor: colors.border,
    },
    sectionHeader: {
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
      color: colors.text,
      marginBottom: Spacing.md,
    },
    debtRow: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.md,
      padding: Spacing.lg,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    debtRowLeft: {
      flex: 1,
    },
    debtRowName: {
      fontSize: FontSize.base,
      fontWeight: FontWeight.medium,
      color: colors.text,
    },
    debtRowType: {
      fontSize: FontSize.xs,
      color: colors.textMuted,
      marginTop: 2,
    },
    debtRowRight: {
      alignItems: 'flex-end',
    },
    debtRowBalance: {
      fontSize: FontSize.base,
      fontWeight: FontWeight.bold,
      color: colors.text,
    },
    debtRowApr: {
      fontSize: FontSize.xs,
      marginTop: 2,
    },
  });
}
