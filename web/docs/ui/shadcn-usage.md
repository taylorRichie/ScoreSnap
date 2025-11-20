# shadcn/ui Usage Guide - ScoreSnap

## Overview

This project has been fully migrated to use **shadcn/ui** as the single source of truth for all reusable UI components. **NO custom HTML components or Tailwind utility classes** should be used for UI primitives.

## Core Principles

✅ **ONLY use shadcn/ui components** for all UI primitives
✅ **NEVER create custom component styles** in `globals.css` or elsewhere
✅ **ALWAYS use shadcn's design tokens** (CSS variables) for theming
✅ **ALWAYS import from `@/components/ui/*`** for reusable components

## Available Components

### Core Primitives
- **Button**: `@/components/ui/button`
- **Input**: `@/components/ui/input`
- **Card**: `@/components/ui/card`
- **Badge**: `@/components/ui/badge`

### Complex Components
- **Table**: `@/components/ui/table`
- **Dialog**: `@/components/ui/dialog`
- **DropdownMenu**: `@/components/ui/dropdown-menu`
- **Avatar**: `@/components/ui/avatar`
- **Slider**: `@/components/ui/slider`

## Usage Examples

### Buttons
```tsx
import { Button } from "@/components/ui/button"

// Basic button
<Button>Click me</Button>

// Variants
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Delete</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>

// With icons
<Button>
  <Plus className="mr-2 h-4 w-4" />
  Add Item
</Button>

// As Link
<Button asChild>
  <Link href="/dashboard">Go to Dashboard</Link>
</Button>
```

### Cards
```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
  </CardHeader>
  <CardContent>
    <p>Card content goes here.</p>
  </CardContent>
</Card>
```

### Tables
```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

<div className="rounded-md border">
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Name</TableHead>
        <TableHead>Email</TableHead>
        <TableHead>Status</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {data.map((item) => (
        <TableRow key={item.id}>
          <TableCell className="font-medium">{item.name}</TableCell>
          <TableCell>{item.email}</TableCell>
          <TableCell>
            <Badge variant={item.active ? "default" : "secondary"}>
              {item.active ? "Active" : "Inactive"}
            </Badge>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>
```

### Dialogs
```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirm Action</DialogTitle>
      <DialogDescription>
        Are you sure you want to perform this action?
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={() => setIsOpen(false)}>
        Cancel
      </Button>
      <Button onClick={handleConfirm}>
        Confirm
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Dropdown Menus
```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">Open Menu</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuLabel>My Account</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem>Profile</DropdownMenuItem>
    <DropdownMenuItem>Settings</DropdownMenuItem>
    <DropdownMenuItem onClick={handleSignOut}>
      Sign out
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### Badges
```tsx
import { Badge } from "@/components/ui/badge"

// Variants
<Badge>Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="destructive">Error</Badge>
<Badge variant="outline">Outline</Badge>
```

### Forms with Inputs
```tsx
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

<form onSubmit={handleSubmit}>
  <div className="space-y-4">
    <div>
      <label htmlFor="email" className="text-sm font-medium">
        Email
      </label>
      <Input
        id="email"
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
    </div>
    <Button type="submit">Submit</Button>
  </div>
</form>
```

## Design Tokens

All components use shadcn's CSS variables. You can customize the theme by modifying these in `globals.css`:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
  --secondary: 210 40% 96%;
  /* ... more variables */
}
```

## Adding New Components

### From shadcn/ui Registry
```bash
# Add a new component
npx shadcn@latest add [component-name]

# Examples
npx shadcn@latest add toast
npx shadcn@latest add tabs
npx shadcn@latest add select
```

### Custom Components (Rare)
If you absolutely need a component not available in shadcn:
1. **Check shadcn registry first** - it's comprehensive
2. **Build on existing shadcn components** - compose them
3. **Follow shadcn patterns** - use CVA, proper TypeScript types
4. **Place in `@/components/ui/`** - never elsewhere

## Layout & Containers

### Page Layouts
Use Tailwind utilities for layout, not custom components:
```tsx
<div className="min-h-screen bg-background">
  <div className="container mx-auto px-4 py-8">
    {/* Content */}
  </div>
</div>
```

### Content Sections
```tsx
<section className="space-y-6">
  <div className="flex items-center justify-between">
    <h1 className="text-3xl font-bold">Page Title</h1>
    <Button>Add New</Button>
  </div>
  {/* Content */}
</section>
```

## Icons

Use **Lucide React** icons (already included):
```tsx
import { Plus, Edit, Trash2, User } from "lucide-react"

// In components
<Button>
  <Plus className="mr-2 h-4 w-4" />
  Add Item
</Button>
```

## Migration Checklist

When adding new UI:

1. ✅ **Check if shadcn has the component** - search shadcn/ui docs
2. ✅ **Import from `@/components/ui/*`** - never create custom styles
3. ✅ **Use shadcn variants and props** - don't override with custom classes
4. ✅ **Test accessibility** - shadcn components are WCAG compliant
5. ✅ **Follow existing patterns** - consistency is key

## Prohibited Patterns

❌ **Don't do this:**
```tsx
// Custom button styles
<button className="bg-blue-500 text-white px-4 py-2 rounded">Custom Button</button>

// Custom component classes
<div className="card shadow-lg p-4">Custom Card</div>

// Inline styles
<div style={{ backgroundColor: 'blue' }}>Styled Div</div>
```

✅ **Do this instead:**
```tsx
// Use shadcn components
<Button>Proper Button</Button>
<Card>
  <CardContent>Proper Card</CardContent>
</Card>
```

## Component Architecture

```
src/
├── components/
│   ├── ui/           # ONLY shadcn components here
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   └── ClientLayout.tsx  # App-specific containers OK
└── app/
    ├── page.tsx         # Pages use shadcn components
    └── layout.tsx       # Layout uses shadcn components
```

---

*Generated during Phase 5 of shadcn/ui migration - Always use shadcn/ui components!* 🎨
