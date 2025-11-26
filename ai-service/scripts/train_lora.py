"""
LoRA fine-tuning script (PEFT) for GPT-2 style models using Hugging Face Trainer.

This script reads passages from `ai-service/data/tfidf_docs.json`, concatenates them
into a training text file, and performs LoRA adapter training using PEFT.

Note: This training can be done on CPU but will be slow. For reasonable speeds use a CUDA GPU.

Usage:
  python scripts/train_lora.py --base_model gpt2 --output_dir models/lora_adapter --epochs 1 --per_device_train_batch_size 2

Requires: transformers, datasets, accelerate, peft, torch
"""
import argparse
import json
from pathlib import Path
import os

def build_train_file(docs_path: Path, out_path: Path):
    with docs_path.open('r', encoding='utf-8') as f:
        docs = json.load(f)
    with out_path.open('w', encoding='utf-8') as out:
        for d in docs:
            text = d.get('text', '').strip()
            if not text:
                continue
            # Simple format: each passage on its own line as plain text
            out.write(text.replace('\n', ' ') + '\n')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base_model', type=str, default='gpt2')
    parser.add_argument('--docs', type=str, default='../data/tfidf_docs.json')
    parser.add_argument('--output_dir', type=str, default='../models/lora_adapter')
    parser.add_argument('--epochs', type=int, default=1)
    parser.add_argument('--per_device_train_batch_size', type=int, default=2)
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    docs_path = (Path(__file__).parent / args.docs).resolve()
    train_txt = Path(__file__).parent / '..' / 'data' / 'train_lora.txt'
    train_txt = train_txt.resolve()
    train_txt.parent.mkdir(parents=True, exist_ok=True)

    print('Building train file...')
    build_train_file(docs_path, train_txt)
    print('Train file written to', train_txt)

    # Import heavy libs only when training
    from datasets import load_dataset
    from transformers import AutoTokenizer, AutoModelForCausalLM, TrainingArguments, Trainer, DataCollatorForLanguageModeling
    from peft import LoraConfig, get_peft_model

    base_model = args.base_model
    tokenizer = AutoTokenizer.from_pretrained(base_model, use_fast=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    ds = load_dataset('text', data_files={'train': str(train_txt)})

    def tokenize_fn(ex):
        return tokenizer(ex['text'], truncation=True, max_length=512)

    tokenized = ds.map(tokenize_fn, batched=True, remove_columns=['text'])
    data_collator = DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False)

    model = AutoModelForCausalLM.from_pretrained(base_model)

    # Prepare PEFT LoRA config
    lora_config = LoraConfig(
        r=8,
        lora_alpha=32,
        target_modules=['c_attn', 'q_proj', 'v_proj'] if 'gpt' in base_model else None,
        lora_dropout=0.05,
        bias='none',
        task_type='CAUSAL_LM'
    )

    model = get_peft_model(model, lora_config)

    training_args = TrainingArguments(
        output_dir=args.output_dir,
        per_device_train_batch_size=args.per_device_train_batch_size,
        num_train_epochs=args.epochs,
        logging_steps=50,
        save_total_limit=2,
        fp16=False,
        remove_unused_columns=False,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized['train'],
        data_collator=data_collator,
    )

    print('Starting LoRA training...')
    trainer.train()
    print('Saving adapter to', args.output_dir)
    model.save_pretrained(args.output_dir)


if __name__ == '__main__':
    main()
