'use client'

import { useState } from 'react'
import { User } from 'lucide-react'

import { BowlerMatch } from '@/lib/bowler-matching'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface NameResolutionModalProps {
  isOpen: boolean
  onClose: () => void
  parsedName: string
  suggestions: BowlerMatch[]
  onResolve: (action: 'create' | 'alias', bowlerId?: string, alias?: string) => void
  isLoading?: boolean
}

export function NameResolutionModal({
  isOpen,
  onClose,
  parsedName,
  suggestions,
  onResolve,
  isLoading = false
}: NameResolutionModalProps) {
  const [selectedAction, setSelectedAction] = useState<'create' | 'alias' | null>(null)
  const [selectedBowler, setSelectedBowler] = useState<BowlerMatch | null>(null)
  const [customAlias, setCustomAlias] = useState('')

  if (!isOpen) return null

  const handleCreateNew = () => {
    onResolve('create')
  }

  const handleAddAlias = () => {
    if (selectedBowler && customAlias.trim()) {
      onResolve('alias', selectedBowler.bowler.id, customAlias.trim())
    }
  }

  const resetModal = () => {
    setSelectedAction(null)
    setSelectedBowler(null)
    setCustomAlias('')
  }

  const handleClose = () => {
    resetModal()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Resolve Bowler Name</DialogTitle>
              <DialogDescription>
                We found "{parsedName}" on the scoreboard. How should we handle this bowler?
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Suggested Matches:</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {suggestions.map((match) => (
                <Card
                  key={match.bowler.id}
                  className={cn(
                    'cursor-pointer transition-colors',
                    selectedBowler?.bowler.id === match.bowler.id
                      ? 'border-primary bg-muted'
                      : 'hover:border-muted'
                  )}
                  onClick={() => {
                    setSelectedBowler(match)
                    setSelectedAction('alias')
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{match.bowler.canonical_name}</p>
                        {match.aliases.length > 0 && (
                          <p className="text-sm text-muted-foreground">
                            Aliases: {match.aliases.map(a => a.alias).join(', ')}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant={
                          match.confidence >= 0.9 ? 'default'
                            : match.confidence >= 0.7 ? 'secondary'
                            : 'outline'
                        }
                      >
                        {Math.round(match.confidence * 100)}%
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {selectedAction === 'alias' && selectedBowler && (
            <Card className="border-primary/50 bg-muted">
              <CardContent className="p-4">
                <p className="mb-3 text-sm text-foreground">
                  Add "{parsedName}" as an alias for <strong>{selectedBowler.bowler.canonical_name}</strong>?
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={handleAddAlias}
                    disabled={isLoading}
                    size="sm"
                  >
                    {isLoading ? 'Adding...' : 'Add Alias'}
                  </Button>
                  <Button
                    onClick={() => setSelectedAction(null)}
                    variant="secondary"
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2">
            <Button
              onClick={() => setSelectedAction('create')}
              variant={selectedAction === 'create' ? 'default' : 'secondary'}
              size="sm"
            >
              Create New Bowler
            </Button>

            {suggestions.length > 0 && (
              <Button
                onClick={() => setSelectedAction('alias')}
                variant={selectedAction === 'alias' ? 'default' : 'secondary'}
                size="sm"
              >
                Add as Alias
              </Button>
            )}
          </div>

          {selectedAction === 'create' && (
            <Card className="border-muted bg-muted">
              <CardContent className="p-4">
                <p className="mb-3 text-sm text-foreground">
                  Create new bowler with name: <strong>"{parsedName}"</strong>
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={handleCreateNew}
                    disabled={isLoading}
                    size="sm"
                  >
                    {isLoading ? 'Creating...' : 'Create Bowler'}
                  </Button>
                  <Button
                    onClick={() => setSelectedAction(null)}
                    variant="secondary"
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
          >
            Skip for Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
