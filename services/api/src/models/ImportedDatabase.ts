import mongoose, { Schema, Document } from 'mongoose';

export interface IImportedDatabase extends Document {
  organizerId: mongoose.Types.ObjectId;
  fileName: string;
  fileSize: number;
  fileType: 'csv' | 'xlsx' | 'json';
  uploadedAt: Date;
  
  // Import status
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'partially_completed';
  
  // Statistics
  stats: {
    totalRecords: number;
    successfulImports: number;
    failedImports: number;
    duplicatesSkipped: number;
    processingTime?: number; // in milliseconds
  };
  
  // Field mapping configuration
  fieldMapping: {
    sourceField: string;
    targetField: string;
    transform?: string; // Optional transformation function name
  }[];
  
  // Import configuration
  config: {
    skipDuplicates: boolean;
    updateExisting: boolean;
    validateData: boolean;
    autoAssignToOrganizer: boolean;
    defaultLeadSource: string;
    defaultLeadStatus: string;
    defaultTags?: string[];
  };
  
  // Error log - renamed to avoid conflict with Document.errors
  importErrors: {
    row: number;
    field?: string;
    value?: any;
    error: string;
    timestamp: Date;
  }[];
  
  // Imported lead IDs for tracking
  importedLeadIds: mongoose.Types.ObjectId[];
  
  // Rollback capability
  canRollback: boolean;
  rolledBackAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

const ImportedDatabaseSchema: Schema = new Schema(
  {
    organizerId: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true,
      index: true
    },
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    fileType: { 
      type: String, 
      enum: ['csv', 'xlsx', 'json'], 
      required: true 
    },
    uploadedAt: { type: Date, default: Date.now },
    
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'partially_completed'],
      default: 'pending',
      index: true
    },
    
    stats: {
      totalRecords: { type: Number, default: 0 },
      successfulImports: { type: Number, default: 0 },
      failedImports: { type: Number, default: 0 },
      duplicatesSkipped: { type: Number, default: 0 },
      processingTime: { type: Number }
    },
    
    fieldMapping: [{
      sourceField: { type: String, required: true },
      targetField: { type: String, required: true },
      transform: { type: String }
    }],
    
    config: {
      skipDuplicates: { type: Boolean, default: true },
      updateExisting: { type: Boolean, default: false },
      validateData: { type: Boolean, default: true },
      autoAssignToOrganizer: { type: Boolean, default: true },
      defaultLeadSource: { type: String, default: 'form' },
      defaultLeadStatus: { type: String, default: 'new' },
      defaultTags: [{ type: String }]
    },
    
    importErrors: [{
      row: { type: Number, required: true },
      field: { type: String },
      value: { type: Schema.Types.Mixed },
      error: { type: String, required: true },
      timestamp: { type: Date, default: Date.now }
    }],
    
    importedLeadIds: [{ 
      type: Schema.Types.ObjectId, 
      ref: 'Lead' 
    }],
    
    canRollback: { type: Boolean, default: true },
    rolledBackAt: { type: Date }
  },
  {
    timestamps: true
  }
);

// Indexes
ImportedDatabaseSchema.index({ organizerId: 1, createdAt: -1 });
ImportedDatabaseSchema.index({ status: 1 });

export default mongoose.model<IImportedDatabase>('ImportedDatabase', ImportedDatabaseSchema);
