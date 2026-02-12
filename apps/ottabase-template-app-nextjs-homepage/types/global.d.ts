// Global type extensions for the template app

// Extend BigInt to support JSON serialization
interface BigInt {
    toJSON(): string;
}
