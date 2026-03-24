import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-chart-kit';
import { useDebts } from '../../src/DebtContext';
import {
  calculatePayoffPlan,
  formatCurrency,
  formatMonths,
  formatPercent,
} from '../../src/calculations';
import { useTheme, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '../../src/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

type TabKey = 'comparison' | 'avalanche' | 'snowball';

export default function PayoffScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { debts, loading } = useDebts();
  const [extraMonthly, setExtraMonthly] = useState(0);
  const [activeTab, setActiveTab] = useState<TabKey>('comparison');

  const styles = makeStyles(colors);

  const plans = useMemo(() => {
    if (debts.length === 0) return null;
    const avalanche = calculatePayoffPlan(debts, 'avalanche', extraMonthly);
    const snowball = calculatePayoffPlan(debts, 'snowball', extraMonthly);
    const interestSaved = snowball.totalInterestPaid - avalanche.totalInterestPaid;
    const monthsSaved = snowball.payoffMonths - avalanche.payoffMonths;
    return { avalanche, snowball, interestSaved, monthsSaved };
  }, [debts, extraMonthly]);

  const chartData = useMemo(() => {
    if (!plans) return null;
    const plan = activeTab === 'snowball' ? plans.snowball : plans.avalanche;
    const schedule = plan.monthlySchedule;
    if (schedule.length === 0) return null;

    // Downsample to ~12 points for readability
    const step = Math.max(1, Math.floor(schedule.length / 12));
    const points = schedule.filter((_, i) => i % step === 0 || i === schedule.length - 1);

    return {
      labels: points.map((p) => {
        const d = new Date(p.date + '-01');
        return `${d.getFullYear().toString().slice(2)}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }),
      datasets: [{ data: points.map((p) => p.remainingBalance) }],
    };
  }, [plans, activeTab]);

  const renderSlider = () => (
    <View style={[styles.sliderCard, Shadow.sm]}>
      <Text style={styles.sliderLabel}>Extra Monthly Payment: {formatCurrency(extraMonthly)}</Text>
      <View style={styles.sliderRow}>
        {[0, 50, 100, 200, 300, 500].map((amount) => (
          <TouchableOpacity
            key={amount}
            style={[
              styles.sliderChip,
              {
                backgroundColor: extraMonthly === amount ? colors.primary : colors.inputBackground,
                borderColor: extraMonthly === amount ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setExtraMonthly(amount)}
          >
            <Text
              style={[
                styles.sliderChipText,
                { color: extraMonthly === amount ? '#fff' : colors.text },
              ]}
            >
              {amount === 0 ? 'None' : `+$${amount}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  if (loading || !plans) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.screenHeader}>
          <Text style={styles.screenTitle}>Payoff Plans</Text>
        </View>
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>📈</Text>
          <Text style={styles.emptyTitle}>No debts to analyze</Text>
          <Text style={styles.emptyBody}>Add debts on the My Debts tab first.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Payoff Plans</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {renderSlider()}

        {/* KPI Cards */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, Shadow.sm]}>
            <Text style={styles.kpiLabel}>Interest Saved</Text>
            <Text style={[styles.kpiValue, { color: colors.success }]}>
              {formatCurrency(plans.interestSaved)}
            </Text>
            <Text style={styles.kpiSub}>Avalanche vs Snowball</Text>
          </View>
          <View style={[styles.kpiCard, Shadow.sm]}>
            <Text style={styles.kpiLabel}>Time Saved</Text>
            <Text style={[styles.kpiValue, { color: colors.primary }]}>
              {plans.monthsSaved > 0 ? formatMonths(plans.monthsSaved) : '—'}
            </Text>
            <Text style={styles.kpiSub}>Avalanche vs Snowball</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={[styles.tabRow, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
          {(['comparison', 'avalanche', 'snowball'] as TabKey[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tab,
                activeTab === tab && { backgroundColor: colors.primary },
              ]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === tab ? '#fff' : colors.textMuted },
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'comparison' && (
          <View style={[styles.compareCard, Shadow.sm]}>
            <View style={styles.compareRow}>
              <View style={styles.compareCol}>
                <Text style={[styles.compareHeader, { color: colors.primary }]}>Avalanche</Text>
                <Text style={styles.compareSubhead}>Highest APR first</Text>
                <View style={styles.compareStat}>
                  <Text style={styles.compareStatLabel}>Payoff Time</Text>
                  <Text style={[styles.compareStatValue, { fontVariant: ['tabular-nums'] }]}>
                    {formatMonths(plans.avalanche.payoffMonths)}
                  </Text>
                </View>
                <View style={styles.compareStat}>
                  <Text style={styles.compareStatLabel}>Total Interest</Text>
                  <Text style={[styles.compareStatValue, { color: colors.destructive, fontVariant: ['tabular-nums'] }]}>
                    {formatCurrency(plans.avalanche.totalInterestPaid)}
                  </Text>
                </View>
                <View style={styles.compareStat}>
                  <Text style={styles.compareStatLabel}>Total Paid</Text>
                  <Text style={[styles.compareStatValue, { fontVariant: ['tabular-nums'] }]}>
                    {formatCurrency(plans.avalanche.totalPaid)}
                  </Text>
                </View>
                <View style={styles.compareStat}>
                  <Text style={styles.compareStatLabel}>Payoff Date</Text>
                  <Text style={styles.compareStatValue}>{plans.avalanche.payoffDate}</Text>
                </View>
              </View>
              <View style={styles.compareDivider} />
              <View style={styles.compareCol}>
                <Text style={[styles.compareHeader, { color: '#8B5CF6' }]}>Snowball</Text>
                <Text style={styles.compareSubhead}>Smallest balance first</Text>
                <View style={styles.compareStat}>
                  <Text style={styles.compareStatLabel}>Payoff Time</Text>
                  <Text style={[styles.compareStatValue, { fontVariant: ['tabular-nums'] }]}>
                    {formatMonths(plans.snowball.payoffMonths)}
                  </Text>
                </View>
                <View style={styles.compareStat}>
                  <Text style={styles.compareStatLabel}>Total Interest</Text>
                  <Text style={[styles.compareStatValue, { color: colors.destructive, fontVariant: ['tabular-nums'] }]}>
                    {formatCurrency(plans.snowball.totalInterestPaid)}
                  </Text>
                </View>
                <View style={styles.compareStat}>
                  <Text style={styles.compareStatLabel}>Total Paid</Text>
                  <Text style={[styles.compareStatValue, { fontVariant: ['tabular-nums'] }]}>
                    {formatCurrency(plans.snowball.totalPaid)}
                  </Text>
                </View>
                <View style={styles.compareStat}>
                  <Text style={styles.compareStatLabel}>Payoff Date</Text>
                  <Text style={styles.compareStatValue}>{plans.snowball.payoffDate}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {(activeTab === 'avalanche' || activeTab === 'snowball') && (
          <>
            {chartData && (
              <View style={[styles.chartCard, Shadow.sm]}>
                <Text style={styles.chartTitle}>Balance Over Time</Text>
                <LineChart
                  data={chartData}
                  width={SCREEN_WIDTH - Spacing.lg * 2 - Spacing.lg * 2}
                  height={200}
                  chartConfig={{
                    backgroundColor: colors.card,
                    backgroundGradientFrom: colors.card,
                    backgroundGradientTo: colors.card,
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(1, 105, 111, ${opacity})`,
                    labelColor: () => colors.textMuted,
                    style: { borderRadius: BorderRadius.md },
                    propsForDots: { r: '3', strokeWidth: '1', stroke: colors.primary },
                  }}
                  bezier
                  style={{ borderRadius: BorderRadius.md }}
                  formatYLabel={(v) => `$${Math.round(Number(v) / 1000)}k`}
                />
              </View>
            )}

            <Text style={styles.sectionHeader}>Payoff Order</Text>
            {(activeTab === 'avalanche' ? plans.avalanche : plans.snowball).debtPayoffOrder.map((item, i) => (
              <View key={item.debtId} style={[styles.orderCard, Shadow.sm]}>
                <View style={[styles.orderNum, { backgroundColor: colors.primary }]}>
                  <Text style={styles.orderNumText}>{i + 1}</Text>
                </View>
                <View style={styles.orderInfo}>
                  <Text style={[styles.orderName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.orderMonth, { color: colors.textMuted }]}>
                    Paid off {formatMonths(item.payoffMonth)} from now
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

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
    emptyIcon: { fontSize: 48, marginBottom: Spacing.lg },
    emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.text, marginBottom: Spacing.sm },
    emptyBody: { fontSize: FontSize.base, color: colors.textMuted },
    sliderCard: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    sliderLabel: { fontSize: FontSize.base, fontWeight: FontWeight.medium, color: colors.text, marginBottom: Spacing.md },
    sliderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    sliderChip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
    },
    sliderChipText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
    kpiRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
    kpiCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
    },
    kpiLabel: { fontSize: FontSize.xs, color: colors.textMuted, fontWeight: FontWeight.medium, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.xs },
    kpiValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.text, fontVariant: ['tabular-nums'] },
    kpiSub: { fontSize: FontSize.xs, color: colors.textMuted, marginTop: 2 },
    tabRow: {
      flexDirection: 'row',
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      padding: 3,
      marginBottom: Spacing.lg,
    },
    tab: {
      flex: 1,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.sm,
      alignItems: 'center',
    },
    tabText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
    compareCard: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    compareRow: { flexDirection: 'row', alignItems: 'flex-start' },
    compareCol: { flex: 1 },
    compareHeader: { fontSize: FontSize.base, fontWeight: FontWeight.bold, marginBottom: 2 },
    compareSubhead: { fontSize: FontSize.xs, color: colors.textMuted, marginBottom: Spacing.md },
    compareStat: { marginBottom: Spacing.sm },
    compareStatLabel: { fontSize: FontSize.xs, color: colors.textMuted },
    compareStatValue: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: colors.text },
    compareDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: Spacing.lg, alignSelf: 'stretch' },
    chartCard: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    chartTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: colors.text, marginBottom: Spacing.md },
    sectionHeader: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: colors.text, marginBottom: Spacing.md },
    orderCard: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.md,
      padding: Spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    orderNum: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: Spacing.md,
    },
    orderNumText: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.sm },
    orderInfo: { flex: 1 },
    orderName: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
    orderMonth: { fontSize: FontSize.sm, marginTop: 2 },
  });
}
