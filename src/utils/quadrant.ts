import { Quadrant, Complexity } from '../generated/prisma/enums';

// Frontend format: 'urgent-important' | 'not-urgent-important' | 'urgent-not-important' | 'not-urgent-not-important'
type FrontendQuadrant = 'urgent-important' | 'not-urgent-important' | 'urgent-not-important' | 'not-urgent-not-important';
type FrontendComplexity = 'easy' | 'medium' | 'hard';

const quadrantToDbMap: Record<FrontendQuadrant, Quadrant> = {
  'urgent-important': Quadrant.URGENT_IMPORTANT,
  'not-urgent-important': Quadrant.NOT_URGENT_IMPORTANT,
  'urgent-not-important': Quadrant.URGENT_NOT_IMPORTANT,
  'not-urgent-not-important': Quadrant.NOT_URGENT_NOT_IMPORTANT,
};

const dbToQuadrantMap: Record<Quadrant, FrontendQuadrant> = {
  [Quadrant.URGENT_IMPORTANT]: 'urgent-important',
  [Quadrant.NOT_URGENT_IMPORTANT]: 'not-urgent-important',
  [Quadrant.URGENT_NOT_IMPORTANT]: 'urgent-not-important',
  [Quadrant.NOT_URGENT_NOT_IMPORTANT]: 'not-urgent-not-important',
};

const complexityToDbMap: Record<FrontendComplexity, Complexity> = {
  'easy': Complexity.EASY,
  'medium': Complexity.MEDIUM,
  'hard': Complexity.HARD,
};

const dbToComplexityMap: Record<Complexity, FrontendComplexity> = {
  [Complexity.EASY]: 'easy',
  [Complexity.MEDIUM]: 'medium',
  [Complexity.HARD]: 'hard',
};

export function toDbQuadrant(quadrant: string): Quadrant {
  const mapped = quadrantToDbMap[quadrant as FrontendQuadrant];
  if (!mapped) {
    throw new Error(`Invalid quadrant: ${quadrant}`);
  }
  return mapped;
}

export function toFrontendQuadrant(quadrant: Quadrant): FrontendQuadrant {
  return dbToQuadrantMap[quadrant];
}

export function toDbComplexity(complexity: string): Complexity {
  const mapped = complexityToDbMap[complexity as FrontendComplexity];
  if (!mapped) {
    throw new Error(`Invalid complexity: ${complexity}`);
  }
  return mapped;
}

export function toFrontendComplexity(complexity: Complexity): FrontendComplexity {
  return dbToComplexityMap[complexity];
}
