#!/usr/bin/env python3
"""
Trek Tribe AI Chatbot Training Script
Uses transformers and torch to train a conversational model
for friendly, human-like travel recommendations
"""

import json
import os
import sys
from pathlib import Path
import torch
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    Trainer,
    TrainingArguments,
    DataCollatorForLanguageModeling,
)
from datasets import Dataset
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
MODEL_NAME = "microsoft/DialoGPT-small"  # Lightweight conversational model
OUTPUT_DIR = Path(__file__).parent.parent / "models" / "trek_ai_bot"
TRAINING_DATA_PATH = Path(__file__).parent.parent / "src" / "data" / "ai_training_data.json"
MAX_LENGTH = 512
EPOCHS = 3
BATCH_SIZE = 4
LEARNING_RATE = 5e-5


def load_training_data():
    """Load and prepare training data from JSON file"""
    logger.info(f"Loading training data from {TRAINING_DATA_PATH}")
    
    if not TRAINING_DATA_PATH.exists():
        raise FileNotFoundError(f"Training data not found at {TRAINING_DATA_PATH}")
    
    with open(TRAINING_DATA_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Extract conversations
    conversations = data.get('conversations', [])
    logger.info(f"Loaded {len(conversations)} conversations")
    
    # Prepare training examples
    training_texts = []
    for conv in conversations:
        # Format: <|user|> input <|bot|> output <|endoftext|>
        text = f"<|user|> {conv['input']} <|bot|> {conv['output']} <|endoftext|>"
        training_texts.append({"text": text})
    
    return training_texts


def prepare_dataset(training_texts, tokenizer):
    """Tokenize and prepare dataset for training"""
    logger.info("Preparing dataset...")
    
    # Create HuggingFace dataset
    dataset = Dataset.from_list(training_texts)
    
    def tokenize_function(examples):
        return tokenizer(
            examples["text"],
            truncation=True,
            max_length=MAX_LENGTH,
            padding="max_length",
        )
    
    tokenized_dataset = dataset.map(
        tokenize_function,
        batched=True,
        remove_columns=["text"],
    )
    
    return tokenized_dataset


def train_model():
    """Main training function"""
    logger.info("="*50)
    logger.info("Trek Tribe AI Chatbot Training")
    logger.info("="*50)
    
    # Check CUDA availability
    device = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info(f"Using device: {device}")
    
    # Load pre-trained model and tokenizer
    logger.info(f"Loading pre-trained model: {MODEL_NAME}")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModelForCausalLM.from_pretrained(MODEL_NAME)
    
    # Add special tokens if needed
    special_tokens = {
        "additional_special_tokens": ["<|user|>", "<|bot|>"]
    }
    num_added_tokens = tokenizer.add_special_tokens(special_tokens)
    model.resize_token_embeddings(len(tokenizer))
    
    logger.info(f"Added {num_added_tokens} special tokens")
    
    # Set pad token
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    
    # Load and prepare training data
    training_texts = load_training_data()
    dataset = prepare_dataset(training_texts, tokenizer)
    
    # Split dataset (80% train, 20% validation)
    split_dataset = dataset.train_test_split(test_size=0.2, seed=42)
    train_dataset = split_dataset["train"]
    eval_dataset = split_dataset["test"]
    
    logger.info(f"Training samples: {len(train_dataset)}")
    logger.info(f"Validation samples: {len(eval_dataset)}")
    
    # Data collator for language modeling
    data_collator = DataCollatorForLanguageModeling(
        tokenizer=tokenizer,
        mlm=False,  # We're doing causal LM, not masked LM
    )
    
    # Training arguments
    training_args = TrainingArguments(
        output_dir=str(OUTPUT_DIR),
        overwrite_output_dir=True,
        num_train_epochs=EPOCHS,
        per_device_train_batch_size=BATCH_SIZE,
        per_device_eval_batch_size=BATCH_SIZE,
        learning_rate=LEARNING_RATE,
        weight_decay=0.01,
        logging_dir=str(OUTPUT_DIR / "logs"),
        logging_steps=10,
        evaluation_strategy="steps",
        eval_steps=50,
        save_steps=100,
        save_total_limit=2,
        warmup_steps=100,
        fp16=torch.cuda.is_available(),  # Use mixed precision if GPU available
        load_best_model_at_end=True,
        report_to="none",  # Disable wandb/tensorboard
    )
    
    # Initialize Trainer
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        data_collator=data_collator,
    )
    
    # Start training
    logger.info("Starting training...")
    logger.info(f"Epochs: {EPOCHS}, Batch size: {BATCH_SIZE}, LR: {LEARNING_RATE}")
    
    trainer.train()
    
    # Save final model
    logger.info(f"Saving model to {OUTPUT_DIR}")
    trainer.save_model(str(OUTPUT_DIR))
    tokenizer.save_pretrained(str(OUTPUT_DIR))
    
    # Evaluate
    logger.info("Evaluating model...")
    eval_results = trainer.evaluate()
    logger.info(f"Evaluation results: {eval_results}")
    
    # Save training metadata
    metadata = {
        "model_name": MODEL_NAME,
        "num_conversations": len(training_texts),
        "epochs": EPOCHS,
        "batch_size": BATCH_SIZE,
        "learning_rate": LEARNING_RATE,
        "max_length": MAX_LENGTH,
        "device": device,
        "eval_loss": eval_results.get("eval_loss", None),
    }
    
    metadata_path = OUTPUT_DIR / "training_metadata.json"
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    
    logger.info("="*50)
    logger.info("Training completed successfully!")
    logger.info(f"Model saved to: {OUTPUT_DIR}")
    logger.info("="*50)
    
    return str(OUTPUT_DIR)


def test_model(model_path=None):
    """Test the trained model with sample inputs"""
    if model_path is None:
        model_path = OUTPUT_DIR
    
    logger.info(f"Loading trained model from {model_path}")
    
    tokenizer = AutoTokenizer.from_pretrained(str(model_path))
    model = AutoModelForCausalLM.from_pretrained(str(model_path))
    
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model.to(device)
    model.eval()
    
    # Test queries
    test_queries = [
        "I want to go trekking in the Himalayas",
        "What's the best time to visit Ladakh?",
        "I'm a beginner, which trek should I choose?",
        "Show me beach trips",
    ]
    
    logger.info("Testing model with sample queries:")
    logger.info("="*50)
    
    for query in test_queries:
        # Format input
        input_text = f"<|user|> {query} <|bot|>"
        input_ids = tokenizer.encode(input_text, return_tensors="pt").to(device)
        
        # Generate response
        with torch.no_grad():
            output_ids = model.generate(
                input_ids,
                max_length=200,
                num_return_sequences=1,
                temperature=0.7,
                top_p=0.9,
                do_sample=True,
                pad_token_id=tokenizer.eos_token_id,
            )
        
        # Decode response
        response = tokenizer.decode(output_ids[0], skip_special_tokens=True)
        response = response.replace(input_text.replace("<|bot|>", "").strip(), "").strip()
        
        logger.info(f"Query: {query}")
        logger.info(f"Response: {response}")
        logger.info("-"*50)


def main():
    """Main execution function"""
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        # Test mode
        test_model()
    else:
        # Training mode
        try:
            # Create output directory
            OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
            
            # Train model
            model_path = train_model()
            
            # Test trained model
            logger.info("\nTesting trained model...")
            test_model(model_path)
            
        except Exception as e:
            logger.error(f"Training failed: {str(e)}", exc_info=True)
            sys.exit(1)


if __name__ == "__main__":
    main()
