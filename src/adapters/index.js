import { createKlingAdapter } from './kling.js';
import { createHiggsfieldAdapter } from './higgsfield.js';
import { createSeedanceAdapter } from './seedance.js';

export const ADAPTER_FACTORIES = [
    createKlingAdapter,
    createHiggsfieldAdapter,
    createSeedanceAdapter
];
