import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

interface Bowler {
  name: string
  scores: (number | null)[]
  average: number
  seriesTotal: number
}

interface RequestBody {
  bowlers: Bowler[]
  location?: string
  sessionDate?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json()
    const { bowlers, location, sessionDate } = body

    // Build context for the AI
    const bowlerInfo = bowlers.map(b => {
      const highScore = Math.max(...b.scores.filter(s => s !== null) as number[])
      const lowScore = Math.min(...b.scores.filter(s => s !== null) as number[])
      const hasStrike = b.scores.some(s => s !== null && s >= 200)
      const hasGutter = b.scores.some(s => s !== null && s < 50)
      
      return {
        name: b.name,
        average: b.average,
        total: b.seriesTotal,
        highScore,
        lowScore,
        hasStrike,
        hasGutter
      }
    })

    // Check for notable achievements
    const achievements = []
    const topBowler = bowlerInfo.reduce((max, b) => b.total > max.total ? b : max, bowlerInfo[0])
    if (topBowler.highScore >= 200) achievements.push(`${topBowler.name} scored ${topBowler.highScore}!`)
    
    const teamAverage = Math.round(bowlerInfo.reduce((sum, b) => sum + b.average, 0) / bowlerInfo.length)
    const teamTotal = bowlerInfo.reduce((sum, b) => sum + b.total, 0)

    // Build prompt
    const prompt = `Generate a playful, creative bowling team name (2-4 words max) based on this team's bowling session:

Team Members: ${bowlers.map(b => b.name).join(', ')}
Location: ${location || 'Unknown'}
Team Total Pins: ${teamTotal}
Team Average: ${teamAverage}
Top Bowler: ${topBowler.name} (${topBowler.total} total, ${topBowler.highScore} high game)
${achievements.length > 0 ? `Notable: ${achievements.join(', ')}` : ''}

Guidelines:
- Keep it fun and bowling-themed
- Reference the location, bowler names, or performance if possible
- Make it memorable but not too long
- Examples: "Strike Force Five", "Gutter Gang", "Pin Crushers", "The Split Happens"

Just respond with the team name, nothing else.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a creative assistant that generates fun, playful bowling team names. Keep them short, memorable, and bowling-themed.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.9,
      max_tokens: 30
    })

    const teamName = completion.choices[0]?.message?.content?.trim()

    if (!teamName) {
      throw new Error('Failed to generate team name')
    }

    return NextResponse.json({ teamName })
  } catch (error) {
    console.error('Error generating team name:', error)
    return NextResponse.json(
      { error: 'Failed to generate team name' },
      { status: 500 }
    )
  }
}

