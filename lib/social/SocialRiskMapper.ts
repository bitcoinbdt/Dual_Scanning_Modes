/**
 * Social Risk Mapper — Phase 3 & 4 Social Signals Module
 *
 * Evaluates verified social presence facts and returns RiskSignal findings
 * for the RiskScoringEngine.
 */

import type { RiskSignal, RiskLevel } from '../deep_scan/types';
import type { SocialMetadataResult } from './SocialMetadataCollector';

let _socRiskCounter = 0;
function makeRiskId(code: string): string {
  _socRiskCounter += 1;
  return `${code}-${_socRiskCounter}`;
}

export class SocialRiskMapper {
  /**
   * Evaluate collector facts and map them to standard RiskSignals.
   */
  static evaluate(socials: SocialMetadataResult): RiskSignal[] {
    const signals: RiskSignal[] = [];
    const { links, websiteAlive, twitterAccountAgeDays, websiteDomainAgeDays, githubLastCommitDays, consistency } = socials;

    const hasWebsite = !!links.website;
    const hasTwitter = !!links.twitter;
    const hasTelegram = !!links.telegram;

    // SOC-001: Completely missing off-chain footprint
    if (!hasWebsite && !hasTwitter && !hasTelegram) {
      signals.push({
        riskId: makeRiskId('SOC-001'),
        severity: 'high' as RiskLevel,
        riskName: 'Missing Social Footprint',
        description: 'SOC-001: The project has no website, Twitter, or Telegram links registered across any indexers.',
        status: 'active',
        evidenceIds: [],
        confidence: 90,
      });
    }

    // SOC-002: Brand new Twitter account (under 7 days)
    if (twitterAccountAgeDays !== null && twitterAccountAgeDays < 7) {
      signals.push({
        riskId: makeRiskId('SOC-002'),
        severity: 'high' as RiskLevel,
        riskName: 'Brand New Twitter Account',
        description: `SOC-002: Project Twitter account is extremely new (${twitterAccountAgeDays} days old), representing typical recycle/cloning behavior.`,
        status: 'active',
        evidenceIds: [],
        confidence: 90,
      });
    }

    // SOC-003: Brand new website domain (under 7 days)
    if (websiteDomainAgeDays !== null && websiteDomainAgeDays < 7) {
      signals.push({
        riskId: makeRiskId('SOC-003'),
        severity: 'medium' as RiskLevel,
        riskName: 'Brand New Domain',
        description: `SOC-003: Project website domain was registered very recently (${websiteDomainAgeDays} days ago), showing low longevity.`,
        status: 'active',
        evidenceIds: [],
        confidence: 85,
      });
    }

    // SOC-004: Inconsistent social links across indexers (phishing spoof warning)
    if (!consistency.consistent && consistency.conflicts.length > 0) {
      const conflictFields = consistency.conflicts.map(c => c.field).join(', ');
      signals.push({
        riskId: makeRiskId('SOC-004'),
        severity: 'high' as RiskLevel,
        riskName: 'Inconsistent Social Links',
        description: `SOC-004: Phishing/clone indicator: Different provider indexers return conflicting URLs for: ${conflictFields}.`,
        status: 'active',
        evidenceIds: [],
        confidence: 95,
      });
    }

    // SOC-005: Stale GitHub repo (no commits in 90 days)
    if (githubLastCommitDays !== null && githubLastCommitDays > 90) {
      signals.push({
        riskId: makeRiskId('SOC-005'),
        severity: 'low' as RiskLevel,
        riskName: 'Stale GitHub Repository',
        description: `SOC-005: Project repository shows no active development commits in the last ${githubLastCommitDays} days.`,
        status: 'active',
        evidenceIds: [],
        confidence: 80,
      });
    }

    // SOC-006: Dead Website
    if (hasWebsite && websiteAlive === false) {
      signals.push({
        riskId: makeRiskId('SOC-006'),
        severity: 'medium' as RiskLevel,
        riskName: 'Dead Website Endpoint',
        description: 'SOC-006: The registered website endpoint resolves to a dead domain or returns error statuses (404/500/timeout).',
        status: 'active',
        evidenceIds: [],
        confidence: 95,
      });
    }

    return signals;
  }
}
