import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDebts } from '../../src/DebtContext';
import {
  simulateScoreImpact,
  calculateUtilization,
  formatCurrency,
  formatPercent,
} from '../../src/calculations';
import { useTheme, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '../../src/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const STORAGE_KEY = 'score_range';

function getScoreLabel(score: number): { label: string; color: string } {
  if (score >= 800) return { label: 'Exceptional', color: '#437A22' };
  if (score >= 740) return { label: 'Very Good', color: '#5FA832' };
  if (score >= 670) return { label: 'Good', color: '#D19900' };
  if (score >= 580) return { label: 'Fair', color: '#E88600' };
  return { label: 'Poor', color: '#C9302C' };
}

export default function ScoreScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { debts, loading } = useDebts();

  const [scoreMin, setScoreMin] = useState('620');
  const [scoreMax, setScoreMax] = useState('680');
  const [lumpSum, setLumpSum] = useState(0);

  const styles = makeStyles(colors);

  const parsedRange: [number, number] = [
    Math.max(300, Math.min(850, parseInt(scoreMin) || 620)),
    Math.max(300, Math.min(850, parseInt(scoreMax) || 680)),
  ];

  const simulation = useMemo(() => {
    if (debts.length === 0) return null;
    return simulateScoreImpact(debts, parsedRange);
  }, [debts, parsedRange[0], parsedRange[1]]);

  const utilization = useMemo(() => calculateUtilization(debts), [debts]);

  const lumpSumUtil = useMemo(() => {
    if (utilization.totalLimit === 0) return 0;
    const newBalance = Math.max(0, utilization.totalBalance - lumpSum);
    return (newBalance / utilization.totalLimit) * 100;
  }, [utilization, lumpSum]);

  const midScore = Math.round((parsedRange[0] + parsedRange[1]) / 2);
  const scoreInfo = getScoreLabel(midScore);
  const scorePosition = ((midScore - 300) / (850 - 300)) * 100;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Score Simulator</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Score Input */}
        <View style={[styles.card, Shadow.sm]}>
          <Text style={styles.cardTitle}>Current Score Range</Text>
          <View style={styles.scoreInputRow}>
            <View style={styles.scoreInputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Min</Text>
              <TextInput
                style={[styles.scoreInput, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                value={scoreMin}
                onChangeText={setScoreMin}
                keyboardType="number-pad"
                maxLength={3}
                placeholder="620"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <Text style={[styles.scoreDash, { color: colors.textMuted }]}>–</Text>
            <View style={styles.scoreInputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Max</Text>
              <TextInput
                style={[styles.scoreInput, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                value={scoreMax}
                onChangeText={setScoreMax}
                keyboardType="number-pad"
                maxLength={3}
                placeholder="680"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
        </View>

        {/* Score Gauge */}
        <View style={[styles.card, Shadow.sm]}>
          <Text style={styles.cardTitle}>Score Gauge</Text>
          <View style={styles.gaugeBar}>
            {/* Colored segments */}
            <View style={[styles.gaugeSegment, { backgroundColor: '#C9302C', flex: 1 }]} />
            <View style={[styles.gaugeSegment, { backgroundColor: '#E88600', flex: 1 }]} />
            <View style={[styles.gaugeSegment, { backgroundColor: '#D19900', flex: 1 }]} />
            <View style={[styles.gaugeSegment, { backgroundColor: '#5FA832', flex: 1 }]} />
            <View style={[styles.gaugeSegment, { backgroundColor: '#437A22', flex: 1 }]} />
            {/* Indicator */}
            <View
              style={[
                styles.gaugeIndicator,
                {
                  left: `${scorePosition}%` as any,
                  backgroundColor: scoreInfo.color,
                },
              ]}
            />
          </View>
          <View style={styles.gaugeLabels}>
            <Text style={[styles.gaugeLabel, { color: colors.textMuted }]}>300</Text>
            <Text style={[styles.gaugeLabel, { color: colors.textMuted }]}>580</Text>
            <Text style={[styles.gaugeLabel, { color: colors.textMuted }]}>670</Text>
            <Text style={[styles.gaugeLabel, { color: colors.textMuted }]}>740</Text>
            <Text style={[styles.gaugeLabel, { color: colors.textMuted }]}>800</Text>
            <Text style={[styles.gaugeLabel, { color: colors.textMuted }]}>850</Text>
          </View>
          <View style={styles.scoreLabelRow}>
            <Text style={[styles.scoreDisplay, { color: scoreInfo.color }]}>
              {parsedRange[0]}–{parsedRange[1]}
            </Text>
            <View style={[styles.scoreBadge, { backgroundColor: scoreInfo.color + '22' }]}>
              <Text style={[styles.scoreBadgeText, { color: scoreInfo.color }]}>{scoreInfo.label}</Text>
            </View>
          </View>
        </View>

        {/* Utilization */}
        {utilization.perCard.length > 0 && (
          <View style={[styles.card, Shadow.sm]}>
            <Text style={styles.cardTitle}>Utilization Breakdown</Text>
            <View style={styles.utilOverall}>
              <Text style={[styles.utilOverallLabel, { color: colors.textMuted }]}>Overall Utilization</Text>
              <Text style={[styles.utilOverallValue, { color: utilization.overall > 30 ? colors.destructive : colors.success, fontVariant: ['tabular-nums'] }]}>
                {formatPercent(utilization.overall)}
              </Text>
            </View>
            {utilization.perCard.map((card) => (
              <View key={card.name} style={styles.utilCard}>
                <View style={styles.utilCardHeader}>
                  <Text style={[styles.utilCardName, { color: colors.text }]}>{card.name}</Text>
                  <Text style={[styles.utilCardPct, { color: card.utilization > 30 ? colors.destructive : colors.success, fontVariant: ['tabular-nums'] }]}>
                    {formatPercent(card.utilization)}
                  </Text>
                </View>
                <View style={[styles.utilBar, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.utilFill,
                      {
                        width: `${Math.min(card.utilization, 100)}%` as any,
                        backgroundColor: card.utilization > 30 ? colors.destructive : colors.success,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.utilCardSub, { color: colors.textMuted }]}>
                  {formatCurrency(card.balance)} of {formatCurrency(card.limit)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Lump Sum Simulator */}
        {utilization.totalLimit > 0 && (
          <View style={[styles.card, Shadow.sm]}>
            <Text style={styles.cardTitle}>Paydown Simulator</Text>
            <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
              How would a lump sum payment affect your utilization?
            </Text>
            <View style={styles.lumpSumRow}>
              {[0, 500, 1000, 2000, 5000].map((amount) => (
                <TouchableOpacity
                  key={amount}
                  style={[
                    styles.lumpChip,
                    {
                      backgroundColor: lumpSum === amount ? colors.primary : colors.inputBackground,
                      borderColor: lumpSum === amount ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setLumpSum(amount)}
                >
                  <Text style={[styles.lumpChipText, { color: lumpSum === amount ? '#fff' : colors.text }]}>
                    {amount === 0 ? '$0' : `$${(amount / 1000).toFixed(amount >= 1000 ? 0 : 1)}k`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.lumpResult}>
              <View style={styles.lumpResultCol}>
                <Text style={[styles.lumpResultLabel, { color: colors.textMuted }]}>Current</Text>
                <Text style={[styles.lumpResultValue, { color: utilization.overall > 30 ? colors.destructive : colors.success }]}>
                  {formatPercent(utilization.overall)}
                </Text>
              </View>
              <Text style={[styles.lumpArrow, { color: colors.textMuted }]}>→</Text>
              <View style={styles.lumpResultCol}>
                <Text style={[styles.lumpResultLabel, { color: colors.textMuted }]}>After Paydown</Text>
                <Text style={[styles.lumpResultValue, { color: lumpSumUtil > 30 ? colors.destructive : colors.success }]}>
                  {formatPercent(lumpSumUtil)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Action Items */}
        {simulation && (
          <View style={[styles.card, Shadow.sm]}>
            <Text style={styles.cardTitle}>Recommended Actions</Text>
            {simulation.afterActions.map((action, i) => (
              <View key={i} style={[styles.actionItem, { borderBottomColor: colors.border }]}>
                <View style={styles.actionTop}>
                  <View style={[styles.actionNumBadge, { backgroundColor: colors.primaryLight }]}>
                    <Text style={[styles.actionNum, { color: colors.primary }]}>{i + 1}</Text>
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={[styles.actionText, { color: colors.text }]}>{action.action}</Text>
                    <Text style={[styles.actionTimeframe, { color: colors.textMuted }]}>{action.timeframe}</Text>
                  </View>
                  <View style={[styles.actionImpact, { backgroundColor: '#E6F4EA' }]}>
                    <Text style={[styles.actionImpactText, { color: colors.success }]}>
                      +{action.impact[0]}–{action.impact[1]} pts
                    </Text>
                  </View>
                </View>
                <View style={styles.actionEstimate}>
                  <Text style={[styles.actionEstimateText, { color: colors.textMuted }]}>
                    Est. score: {action.newEstimate[0]}–{action.newEstimate[1]}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {debts.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>⭐</Text>
            <Text style={styles.emptyTitle}>No debts added</Text>
            <Text style={styles.emptyBody}>Add debts to see personalized score improvement actions.</Text>
          </View>
        )}
      </ScrollView>
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
    card: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    cardTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: colors.text, marginBottom: Spacing.md },
    cardSubtitle: { fontSize: FontSize.sm, marginBottom: Spacing.md },
    scoreInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    scoreInputGroup: { flex: 1 },
    inputLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, marginBottom: Spacing.xs },
    scoreInput: {
      borderWidth: 1,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      fontSize: FontSize.xl,
      fontWeight: FontWeight.bold,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },
    scoreDash: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, marginTop: Spacing.lg },
    gaugeBar: {
      flexDirection: 'row',
      height: 16,
      borderRadius: BorderRadius.full,
      overflow: 'visible',
      position: 'relative',
      marginBottom: Spacing.sm,
    },
    gaugeSegment: { height: 16 },
    gaugeIndicator: {
      position: 'absolute',
      top: -4,
      width: 24,
      height: 24,
      borderRadius: 12,
      marginLeft: -12,
      borderWidth: 3,
      borderColor: '#fff',
    },
    gaugeLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: Spacing.md,
    },
    gaugeLabel: { fontSize: FontSize.xs },
    scoreLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    scoreDisplay: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, fontVariant: ['tabular-nums'] },
    scoreBadge: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full },
    scoreBadgeText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
    utilOverall: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
    utilOverallLabel: { fontSize: FontSize.sm },
    utilOverallValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
    utilCard: { marginBottom: Spacing.md },
    utilCardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    utilCardName: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
    utilCardPct: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
    utilBar: { height: 8, borderRadius: BorderRadius.full, overflow: 'hidden', marginBottom: 4 },
    utilFill: { height: '100%', borderRadius: BorderRadius.full },
    utilCardSub: { fontSize: FontSize.xs },
    lumpSumRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
    lumpChip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
    },
    lumpChipText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
    lumpResult: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xl },
    lumpResultCol: { alignItems: 'center' },
    lumpResultLabel: { fontSize: FontSize.xs, marginBottom: 4 },
    lumpResultValue: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, fontVariant: ['tabular-nums'] },
    lumpArrow: { fontSize: FontSize.xl },
    actionItem: { paddingVertical: Spacing.md, borderBottomWidth: 1 },
    actionTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
    actionNumBadge: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    actionNum: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
    actionContent: { flex: 1 },
    actionText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, lineHeight: 20 },
    actionTimeframe: { fontSize: FontSize.xs, marginTop: 2 },
    actionImpact: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: BorderRadius.full },
    actionImpactText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
    actionEstimate: { marginTop: 4, paddingLeft: 32 },
    actionEstimateText: { fontSize: FontSize.xs },
    emptyState: { alignItems: 'center', paddingTop: 40 },
    emptyIcon: { fontSize: 48, marginBottom: Spacing.lg },
    emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.text, marginBottom: Spacing.sm },
    emptyBody: { fontSize: FontSize.base, color: colors.textMuted, textAlign: 'center' },
  });
}
