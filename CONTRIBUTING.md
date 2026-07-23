# Contributing to JSON API Server

Thank you for your interest in contributing! This document provides guidelines and information for contributors.

## Commit Message Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/) with [commitlint](https://commitlint.js.org/) enforcement.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(api): add user authentication` |
| `fix` | Bug fix | `fix(frontend): resolve dark mode toggle` |
| `docs` | Documentation only | `docs: add API endpoints documentation` |
| `style` | Code style (formatting, semicolons) | `style: format code with prettier` |
| `refactor` | Code refactoring | `refactor(api): extract auth middleware` |
| `perf` | Performance improvements | `perf(db): optimize query performance` |
| `test` | Adding/updating tests | `test(api): add rate limiter tests` |
| `chore` | Build/tooling changes | `chore: update dependencies` |
| `ci` | CI configuration | `ci: add GitHub Actions workflow` |
| `revert` | Revert previous commit | `revert: undo auth changes` |

### Rules

1. **Subject line**: Use imperative mood, lowercase, no period, max 72 characters
2. **Body**: Use bullet points with `- ` prefix, wrap at 100 characters
3. **Scope**: Use lowercase, e.g., `(api)`, `(frontend)`, `(db)`
4. **Breaking changes**: Add `BREAKING CHANGE:` in footer

### Examples

#### Good

```
feat(api): add user authentication endpoint

- Implement JWT token generation
- Add password hashing with bcrypt
- Include refresh token rotation

Closes #123
```

```
fix(frontend): resolve dark mode toggle not persisting

- Store theme preference in localStorage
- Apply theme on page load

Fixes #456
```

```
test(api): add rate limiter edge case tests

- Test in-memory fallback when Redis is unavailable
- Cover circuit breaker state transitions
- Test CIDR matching and IP normalization edge cases
```

#### Bad

```
Added new feature (missing type, not imperative)
```

```
fix stuff (too vague)
```

```
FEAT(API): ADD USER AUTHENTICATION (uppercase not allowed)
```

### Commit Size Guidelines

| Size | Lines | Recommendation |
|------|-------|----------------|
| Small | <200 | Ideal for most changes |
| Medium | 200-500 | Acceptable for features with tests |
| Large | >500 | Consider splitting |
| Very Large | >1000 | Must be split |

**When a commit exceeds 500 lines, consider splitting:**

1. Implementation changes first
2. Test updates in a separate commit
3. Documentation in another commit

### Running Tests Before Commit

```bash
# Run all tests
yarn test

# Run specific test suite
yarn test:api
yarn test:frontend

# Check coverage
yarn test:coverage
```

### Pre-commit Hooks

Husky runs automatically before each commit:
- ESLint for code quality
- Prettier for formatting
- Type checking with vue-tsc/tsc

## Development Workflow

### 1. Fork and Clone

```bash
git clone https://github.com/your-username/json-api-server-with-dashboard-ui.git
cd json-api-server-with-dashboard-ui
```

### 2. Install Dependencies

```bash
yarn install
```

### 3. Create Feature Branch

```bash
git checkout -b feat/your-feature-name
```

### 4. Make Changes and Test

```bash
# Make your changes
yarn test  # Ensure tests pass
yarn lint  # Ensure code style
```

### 5. Commit and Push

```bash
git add .
git commit -m "feat(scope): your feature description"
git push origin feat/your-feature-name
```

### 6. Create Pull Request

- Provide clear description of changes
- Reference any related issues
- Ensure all CI checks pass

## Code Style

- **TypeScript** for all backend code
- **Vue 3 Composition API** for frontend
- **Tailwind CSS** for styling
- **ESLint + Prettier** for formatting

## Testing

- **Backend**: Vitest with 100% coverage target
- **Frontend**: Vue Test Utils with jsdom
- **Integration**: Real SQLite + HTTP tests

## Questions?

If you have questions, please open an issue or reach out to the maintainers.
