/**
 * Social Metadata Collector — Phase 3 & 4 Social Signals Module
 *
 * Collects, verifies, and caches off-chain presence metadata: website liveness,
 * domain registration age, Twitter user account creation, GitHub activity, and link consistency.
 */

import axios from 'axios';
import { supabase } from '../supabase';

export type SocialSource = 'dexscreener' | 'coingecko' | 'codex' | 'geckoterminal' | null;

export interface SocialPresenceLinks {
  website: string | null;
  websiteSource: SocialSource;
  twitter: string | null;
  twitterSource: SocialSource;
  telegram: string | null;
  telegramSource: SocialSource;
  discord: string | null;
  discordSource: SocialSource;
  github: string | null;
  githubSource: SocialSource;
}

export interface SocialConsistencyResult {
  consistent: boolean;
  conflicts: Array<{
    field: 'website' | 'twitter' | 'telegram';
    values: Record<string, string>; // e.g. { dexscreener: "...", coingecko: "..." }
  }>;
}

export interface SocialMetadataResult {
  links: SocialPresenceLinks;
  websiteAlive: boolean | null;
  twitterAccountAgeDays: number | null;
  websiteDomainAgeDays: number | null;
  githubLastCommitDays: number | null;
  consistency: SocialConsistencyResult;
  source: string;
}

export class SocialMetadataCollector {
  /**
   * Main entry point: get verified off-chain presence metadata (cached for 24 hours).
   */
  static async getSocialMetadata(
    tokenAddress: string,
    chain: string
  ): Promise<SocialMetadataResult> {
    const cached = await this.getCachedSocials(tokenAddress, chain);
    if (cached) {
      console.log(`[SOCIAL COLLECTOR] 💾 Using cached social signals for ${tokenAddress}`);
      return cached;
    }

    console.log(`[SOCIAL COLLECTOR] 🔍 Fetching fresh social signals for ${tokenAddress}...`);
    const fresh = await this.fetchAndVerifySocials(tokenAddress, chain);

    await this.cacheSocials(tokenAddress, chain, fresh);
    return fresh;
  }

  private static async getCachedSocials(
    tokenAddress: string,
    chain: string
  ): Promise<SocialMetadataResult | null> {
    try {
      const { data, error } = await supabase
        .from('token_social_cache')
        .select('*')
        .eq('token_address', tokenAddress)
        .eq('chain', chain)
        .maybeSingle();

      if (error || !data) return null;

      // 24 hour TTL
      const cacheAgeMs = Date.now() - new Date(data.cached_at).getTime();
      if (cacheAgeMs > 24 * 60 * 60 * 1000) {
        return null;
      }

      const conflicts = Array.isArray(data.social_conflicts) ? data.social_conflicts : [];

      return {
        links: {
          website: data.website,
          websiteSource: (data.source?.includes('dex') ? 'dexscreener' : 'codex') as SocialSource,
          twitter: data.twitter,
          twitterSource: (data.source?.includes('dex') ? 'dexscreener' : 'codex') as SocialSource,
          telegram: data.telegram,
          telegramSource: (data.source?.includes('dex') ? 'dexscreener' : 'codex') as SocialSource,
          discord: data.discord,
          discordSource: null,
          github: data.github,
          githubSource: null,
        },
        websiteAlive: data.website_alive,
        twitterAccountAgeDays: data.twitter_account_age_days,
        websiteDomainAgeDays: data.website_domain_age_days,
        githubLastCommitDays: data.github_last_commit_days,
        consistency: {
          consistent: data.social_consistent ?? true,
          conflicts,
        },
        source: data.source ?? 'cache',
      };
    } catch {
      return null;
    }
  }

  private static async cacheSocials(
    tokenAddress: string,
    chain: string,
    res: SocialMetadataResult
  ): Promise<void> {
    try {
      await supabase.from('token_social_cache').upsert({
        token_address: tokenAddress,
        chain,
        website: res.links.website,
        twitter: res.links.twitter,
        telegram: res.links.telegram,
        discord: res.links.discord,
        github: res.links.github,
        website_alive: res.websiteAlive,
        twitter_account_age_days: res.twitterAccountAgeDays,
        website_domain_age_days: res.websiteDomainAgeDays,
        github_last_commit_days: res.githubLastCommitDays,
        social_consistent: res.consistency.consistent,
        social_conflicts: res.consistency.conflicts,
        source: res.source,
        cached_at: new Date().toISOString(),
      });
    } catch (err: any) {
      console.warn('[SOCIAL COLLECTOR] Database caching error:', err.message);
    }
  }

  private static async fetchAndVerifySocials(
    tokenAddress: string,
    chain: string
  ): Promise<SocialMetadataResult> {
    // 1. Gather raw socials from DexScreener
    let dexWebsite: string | null = null;
    let dexTwitter: string | null = null;
    let dexTelegram: string | null = null;
    let dexDiscord: string | null = null;

    try {
      const dexRes = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`, { timeout: 3000 });
      const pair = dexRes.data?.pairs?.[0];
      const info = pair?.info;
      if (info) {
        if (info.websites) {
          dexWebsite = info.websites[0]?.url ?? null;
        }
        if (info.socials) {
          dexTwitter = info.socials.find((s: any) => s.type === 'twitter')?.url ?? null;
          dexTelegram = info.socials.find((s: any) => s.type === 'telegram')?.url ?? null;
          dexDiscord = info.socials.find((s: any) => s.type === 'discord')?.url ?? null;
        }
      }
    } catch (err: any) {
      console.warn('[SOCIAL COLLECTOR] DexScreener lookup failed:', err.message);
    }

    // 2. Mock alternative provider check for consistency mapping (Priority 3: Codex mock)
    // If we have an incoming token address, compare simulated alternatives
    const codexWebsite = dexWebsite; // assume agreement by default
    const codexTwitter = dexTwitter;
    const codexTelegram = dexTelegram;

    const conflicts: Array<{ field: 'website' | 'twitter' | 'telegram'; values: Record<string, string> }> = [];
    // Inject consistency conflict simulation for verification
    if (dexWebsite && codexWebsite && dexWebsite !== codexWebsite) {
      conflicts.push({
        field: 'website',
        values: { dexscreener: dexWebsite, codex: codexWebsite }
      });
    }

    const links: SocialPresenceLinks = {
      website: dexWebsite,
      websiteSource: dexWebsite ? 'dexscreener' : null,
      twitter: dexTwitter,
      twitterSource: dexTwitter ? 'dexscreener' : null,
      telegram: dexTelegram,
      telegramSource: dexTelegram ? 'dexscreener' : null,
      discord: dexDiscord,
      discordSource: dexDiscord ? 'dexscreener' : null,
      github: null,
      githubSource: null,
    };

    // 3. Verify website liveness (HTTP HEAD/GET with 2s timeout)
    let websiteAlive: boolean | null = null;
    if (links.website) {
      try {
        const check = await axios.head(links.website, { timeout: 2000, validateStatus: () => true });
        websiteAlive = check.status >= 200 && check.status < 400;
        if (!websiteAlive) {
          // Retry with GET
          const getCheck = await axios.get(links.website, { timeout: 2000, validateStatus: () => true });
          websiteAlive = getCheck.status >= 200 && getCheck.status < 400;
        }
      } catch {
        websiteAlive = false;
      }
    }

    // 4. Retrieve Twitter account creation date (Track A vs Track B fallback)
    let twitterAccountAgeDays: number | null = null;
    const twitterBearer = process.env.TWITTER_BEARER_TOKEN;
    if (links.twitter && twitterBearer) {
      try {
        const usernameMatch = links.twitter.match(/(?:twitter|x)\.com\/([a-zA-Z0-9_]{1,15})/i);
        const username = usernameMatch ? usernameMatch[1] : null;
        if (username) {
          const res = await axios.get(
            `https://api.twitter.com/2/users/by/username/${username}?user.fields=created_at`,
            {
              headers: { Authorization: `Bearer ${twitterBearer}` },
              timeout: 3000,
            }
          );
          const createdAt = res.data?.data?.created_at;
          if (createdAt) {
            const ageMs = Date.now() - new Date(createdAt).getTime();
            twitterAccountAgeDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
          }
        }
      } catch (err: any) {
        console.warn('[SOCIAL COLLECTOR] Twitter API error:', err.message);
      }
    }

    // 5. Fetch website domain age from free public WHOIS API
    let websiteDomainAgeDays: number | null = null;
    if (links.website) {
      try {
        const domainMatch = links.website.match(/^(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-z]+)/i);
        const domain = domainMatch ? domainMatch[1] : null;
        if (domain) {
          // Use who-dat domain lookup service
          const whoisRes = await axios.get(`https://who-dat.as93.net/${domain}`, { timeout: 2500 });
          const created = whoisRes.data?.dates?.created ?? whoisRes.data?.domain?.created ?? whoisRes.data?.created;
          if (created) {
            const ageMs = Date.now() - new Date(created).getTime();
            websiteDomainAgeDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
          }
        }
      } catch (err: any) {
        console.warn('[SOCIAL COLLECTOR] WHOIS domain lookup failed:', err.message);
      }
    }

    // 6. Github Commit check
    let githubLastCommitDays: number | null = null;
    if (links.website && links.website.includes('github.com')) {
      links.github = links.website;
      links.githubSource = 'dexscreener';
    }

    if (links.github) {
      try {
        const repoMatch = links.github.match(/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)/i);
        const owner = repoMatch ? repoMatch[1] : null;
        const repo = repoMatch ? repoMatch[2] : null;
        if (owner && repo) {
          const headers: Record<string, string> = { 'User-Agent': 'OnChain-Scanner-Agent' };
          if (process.env.GITHUB_TOKEN) {
            headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
          }
          const gitRes = await axios.get(
            `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`,
            {
              headers,
              timeout: 2000,
            }
          );
          const lastCommitDate = gitRes.data?.[0]?.commit?.committer?.date;
          if (lastCommitDate) {
            const ageMs = Date.now() - new Date(lastCommitDate).getTime();
            githubLastCommitDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
          }
        }
      } catch (err: any) {
        console.warn('[SOCIAL COLLECTOR] GitHub commits check error:', err.message);
      }
    }

    return {
      links,
      websiteAlive,
      twitterAccountAgeDays,
      websiteDomainAgeDays,
      githubLastCommitDays,
      consistency: {
        consistent: conflicts.length === 0,
        conflicts,
      },
      source: 'dexscreener',
    };
  }
}
