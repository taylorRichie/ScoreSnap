import { supabase } from './supabase'

export interface BowlerMatch {
  bowler: {
    id: string
    canonical_name: string
    primary_user_id: string | null
  }
  aliases: Array<{
    alias: string
    confidence_score: number
  }>
  confidence: number
  match_type: 'exact' | 'alias' | 'fuzzy'
}

export interface NameResolutionResult {
  resolved_bowler_id: string | null
  needs_user_input: boolean
  suggestions: BowlerMatch[]
  parsed_name: string
}

/**
 * Calculate similarity between two names using Levenshtein distance
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null))

  for (let i = 0; i <= a.length; i++) matrix[0][i] = i
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,     // deletion
        matrix[j - 1][i] + 1,     // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      )
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Calculate similarity score between 0 and 1 (1 = perfect match)
 */
function calculateSimilarity(name1: string, name2: string): number {
  const distance = levenshteinDistance(name1.toLowerCase(), name2.toLowerCase())
  const maxLength = Math.max(name1.length, name2.length)
  return maxLength === 0 ? 1 : (maxLength - distance) / maxLength
}

/**
 * Normalize a name for comparison (remove extra spaces, lowercase, etc.)
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^a-zA-Z0-9\s]/g, '')
}

/**
 * Find potential bowler matches for a parsed name
 */
export async function findBowlerMatches(parsedName: string): Promise<BowlerMatch[]> {
  const normalizedParsed = normalizeName(parsedName)
  const matches: BowlerMatch[] = []

  // Get all bowlers and their aliases
  const { data: bowlers, error } = await supabase
    .from('bowlers')
    .select(`
      id,
      canonical_name,
      primary_user_id,
      bowler_aliases (
        alias,
        confidence_score
      )
    `)

  if (error) {
    console.error('Error fetching bowlers:', error)
    return []
  }

  for (const bowler of bowlers || []) {
    const bowlerMatches: BowlerMatch[] = []

    // Check canonical name match
    const canonicalSimilarity = calculateSimilarity(normalizedParsed, normalizeName(bowler.canonical_name))
    if (canonicalSimilarity >= 0.8) { // High confidence match
      bowlerMatches.push({
        bowler: {
          id: bowler.id,
          canonical_name: bowler.canonical_name,
          primary_user_id: bowler.primary_user_id
        },
        aliases: bowler.bowler_aliases || [],
        confidence: canonicalSimilarity,
        match_type: 'exact'
      })
    }

    // Check alias matches
    for (const alias of bowler.bowler_aliases || []) {
      const aliasSimilarity = calculateSimilarity(normalizedParsed, normalizeName(alias.alias))
      if (aliasSimilarity >= 0.7) { // Good confidence for alias match
        bowlerMatches.push({
          bowler: {
            id: bowler.id,
            canonical_name: bowler.canonical_name,
            primary_user_id: bowler.primary_user_id
          },
          aliases: bowler.bowler_aliases || [],
          confidence: aliasSimilarity,
          match_type: 'alias'
        })
      }
    }

    // Check fuzzy matches (lower confidence)
    if (bowlerMatches.length === 0) {
      const fuzzySimilarity = calculateSimilarity(normalizedParsed, normalizeName(bowler.canonical_name))
      if (fuzzySimilarity >= 0.6) { // Moderate confidence
        bowlerMatches.push({
          bowler: {
            id: bowler.id,
            canonical_name: bowler.canonical_name,
            primary_user_id: bowler.primary_user_id
          },
          aliases: bowler.bowler_aliases || [],
          confidence: fuzzySimilarity,
          match_type: 'fuzzy'
        })
      }
    }

    matches.push(...bowlerMatches)
  }

  // Sort by confidence (highest first) and remove duplicates
  const uniqueMatches = matches
    .filter((match, index, self) =>
      index === self.findIndex(m => m.bowler.id === match.bowler.id)
    )
    .sort((a, b) => b.confidence - a.confidence)

  return uniqueMatches
}

/**
 * Resolve a parsed bowler name to an existing bowler or determine if user input is needed
 */
export async function resolveBowlerName(parsedName: string): Promise<NameResolutionResult> {
  const matches = await findBowlerMatches(parsedName)

  // High confidence match (exact or very close alias)
  if (matches.length > 0 && matches[0].confidence >= 0.8) {
    return {
      resolved_bowler_id: matches[0].bowler.id,
      needs_user_input: false,
      suggestions: matches.slice(0, 3), // Top 3 suggestions
      parsed_name: parsedName
    }
  }

  // Moderate confidence - needs user input
  if (matches.length > 0) {
    return {
      resolved_bowler_id: null,
      needs_user_input: true,
      suggestions: matches.slice(0, 5), // Top 5 suggestions
      parsed_name: parsedName
    }
  }

  // No matches found - for new bowlers, auto-create instead of requiring input
  return {
    resolved_bowler_id: null,
    needs_user_input: false, // Changed: auto-create new bowlers
    suggestions: [],
    parsed_name: parsedName
  }
}

/**
 * Create a new bowler with the given name
 */
export async function createNewBowler(canonicalName: string, createdByUserId: string, supabaseClient?: any): Promise<string | null> {
  console.log('🎳 Creating bowler:', { canonicalName, createdByUserId })

  const client = supabaseClient || supabase
  const { data: bowler, error } = await client
    .from('bowlers')
    .insert({
      canonical_name: canonicalName,
      created_by_user_id: createdByUserId
    })
    .select()
    .single()

  console.log('🎳 Bowler creation result:', { bowler, error })

  if (error) {
    console.error('❌ Error creating bowler:', error)
    return null
  }

  console.log('✅ Bowler created successfully:', bowler.id)
  return bowler.id
}

/**
 * Add an alias to an existing bowler
 */
export async function addBowlerAlias(bowlerId: string, alias: string, source: 'manual' | 'auto_vision' = 'auto_vision'): Promise<boolean> {
  const { error } = await supabase
    .from('bowler_aliases')
    .insert({
      bowler_id: bowlerId,
      alias: alias,
      source: source,
      confidence_score: 0.8 // Default confidence for manually added aliases
    })

  if (error) {
    console.error('Error adding bowler alias:', error)
    return false
  }

  return true
}

/**
 * Get all aliases for a bowler
 */
export async function getBowlerAliases(bowlerId: string): Promise<Array<{ alias: string, confidence_score: number }>> {
  const { data: aliases, error } = await supabase
    .from('bowler_aliases')
    .select('alias, confidence_score')
    .eq('bowler_id', bowlerId)

  if (error) {
    console.error('Error fetching bowler aliases:', error)
    return []
  }

  return aliases || []
}

/**
 * Search bowlers by name (for admin/manual resolution)
 */
export async function searchBowlers(searchTerm: string, limit: number = 10): Promise<Array<{ id: string, canonical_name: string }>> {
  const normalizedSearch = normalizeName(searchTerm)

  const { data: bowlers, error } = await supabase
    .from('bowlers')
    .select('id, canonical_name')
    .ilike('canonical_name', `%${normalizedSearch}%`)
    .limit(limit)

  if (error) {
    console.error('Error searching bowlers:', error)
    return []
  }

  return bowlers || []
}
