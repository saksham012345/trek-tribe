#!/usr/bin/env python3
"""
Comprehensive AI Service Test Script
Tests local AI service endpoints and responses
"""

import os
import requests
import json
import sys
from datetime import datetime

# Configuration
AI_SERVICE_URL = os.environ.get("AI_SERVICE_URL", "http://localhost:8000")
AI_SERVICE_KEY = os.environ.get("AI_SERVICE_KEY", "5YDVAJioLzl0wq0u1r4X9na6ypPkZpiQeEUynHaDMo0=")

# Color codes
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
CYAN = '\033[96m'
RESET = '\033[0m'

class AIServiceTester:
    def __init__(self):
        self.results = {
            "health": [],
            "ready": [],
            "retrieve": [],
            "generate": [],
            "summary": {}
        }
        self.timestamp = datetime.now().isoformat()

    def test_health(self):
        """Test AI service health endpoint"""
        print(f"\n{CYAN}Testing Health Endpoint...{RESET}")
        try:
            response = requests.get(f"{AI_SERVICE_URL}/health", timeout=5)
            response.raise_for_status()
            data = response.json()
            print(f"{GREEN}✓ Health check passed{RESET}")
            print(f"  Status: {data.get('status', 'N/A')}")
            self.results["health"].append({"status": "passed", "data": data})
            return True
        except Exception as e:
            print(f"{RED}✗ Health check failed: {str(e)}{RESET}")
            self.results["health"].append({"status": "failed", "error": str(e)})
            return False

    def test_ready(self):
        """Test AI service ready endpoint"""
        print(f"\n{CYAN}Testing Ready Endpoint...{RESET}")
        try:
            response = requests.get(f"{AI_SERVICE_URL}/ready", timeout=5)
            response.raise_for_status()
            data = response.json()
            print(f"{GREEN}✓ Ready check passed{RESET}")
            print(f"  Ready: {data.get('ready', False)}")
            print(f"  Model loaded: {data.get('model_loaded', False)}")
            print(f"  Local model enabled: {data.get('model_local', False)}")
            self.results["ready"].append({"status": "passed", "data": data})
            return True
        except Exception as e:
            print(f"{RED}✗ Ready check failed: {str(e)}{RESET}")
            self.results["ready"].append({"status": "failed", "error": str(e)})
            return False

    def test_retrieve(self):
        """Test document retrieval endpoint"""
        print(f"\n{CYAN}Testing Retrieve Endpoint...{RESET}")
        test_queries = [
            "How do I create a trip?",
            "What are the best treks for beginners?",
            "How do I book a trek?"
        ]

        for query in test_queries:
            try:
                response = requests.post(
                    f"{AI_SERVICE_URL}/retrieve",
                    json={"query": query, "top_k": 2},
                    headers={"x-api-key": AI_SERVICE_KEY},
                    timeout=10
                )
                response.raise_for_status()
                data = response.json()
                retrieved_count = len(data.get("retrieved", []))
                print(f"{GREEN}✓ Retrieved {retrieved_count} documents for: '{query}'{RESET}")
                self.results["retrieve"].append({
                    "status": "passed",
                    "query": query,
                    "count": retrieved_count
                })
            except Exception as e:
                print(f"{RED}✗ Retrieve failed for '{query}': {str(e)}{RESET}")
                self.results["retrieve"].append({
                    "status": "failed",
                    "query": query,
                    "error": str(e)
                })

    def test_generate(self):
        """Test text generation endpoint"""
        print(f"\n{CYAN}Testing Generate Endpoint...{RESET}")
        test_prompts = [
            {
                "prompt": "What are the best treks for beginners in the Himalayas?",
                "max_tokens": 100,
                "top_k": 3
            },
            {
                "prompt": "I cannot login to my account, please help me reset my password.",
                "max_tokens": 80,
                "top_k": 2
            },
            {
                "prompt": "How do I cancel my trek booking?",
                "max_tokens": 100,
                "top_k": 3
            }
        ]

        for test_prompt in test_prompts:
            try:
                response = requests.post(
                    f"{AI_SERVICE_URL}/generate",
                    json=test_prompt,
                    headers={"x-api-key": AI_SERVICE_KEY, "Content-Type": "application/json"},
                    timeout=15
                )
                response.raise_for_status()
                data = response.json()
                text = data.get("text", "")
                text_preview = text[:100] + "..." if len(text) > 100 else text
                print(f"{GREEN}✓ Generation successful for: '{test_prompt['prompt'][:50]}...'{RESET}")
                print(f"  Response: {text_preview}")
                self.results["generate"].append({
                    "status": "passed",
                    "prompt": test_prompt['prompt'],
                    "response_length": len(text)
                })
            except Exception as e:
                print(f"{RED}✗ Generation failed: {str(e)}{RESET}")
                self.results["generate"].append({
                    "status": "failed",
                    "prompt": test_prompt['prompt'],
                    "error": str(e)
                })

    def print_summary(self):
        """Print test summary"""
        print(f"\n{CYAN}{'='*60}")
        print("AI SERVICE TEST SUMMARY")
        print(f"{'='*60}{RESET}")

        total_tests = sum(len(v) for k, v in self.results.items() if k != "summary")
        passed_tests = sum(1 for v in self.results.values() if isinstance(v, list) 
                          for test in v if test.get("status") == "passed")

        print(f"\n{YELLOW}Health Checks:{RESET}")
        for test in self.results["health"]:
            symbol = f"{GREEN}✓{RESET}" if test["status"] == "passed" else f"{RED}✗{RESET}"
            print(f"  {symbol} {test['status'].upper()}")

        print(f"\n{YELLOW}Ready Checks:{RESET}")
        for test in self.results["ready"]:
            symbol = f"{GREEN}✓{RESET}" if test["status"] == "passed" else f"{RED}✗{RESET}"
            print(f"  {symbol} {test['status'].upper()}")

        print(f"\n{YELLOW}Retrieve Tests: {len(self.results['retrieve'])} total{RESET}")
        passed_retrieve = sum(1 for t in self.results["retrieve"] if t["status"] == "passed")
        print(f"  {GREEN}✓{RESET} Passed: {passed_retrieve}/{len(self.results['retrieve'])}")

        print(f"\n{YELLOW}Generate Tests: {len(self.results['generate'])} total{RESET}")
        passed_generate = sum(1 for t in self.results["generate"] if t["status"] == "passed")
        print(f"  {GREEN}✓{RESET} Passed: {passed_generate}/{len(self.results['generate'])}")

        if total_tests > 0:
            pass_rate = (passed_tests / total_tests) * 100
            print(f"\n{CYAN}Overall Pass Rate: {pass_rate:.1f}% ({passed_tests}/{total_tests}){RESET}")

            if pass_rate == 100:
                print(f"{GREEN}🎉 All tests passed! AI service is working correctly.{RESET}")
            elif pass_rate >= 80:
                print(f"{YELLOW}⚠ Most tests passed, but some issues remain.{RESET}")
            else:
                print(f"{RED}❌ Critical issues found. Please review failures above.{RESET}")

        # Save results to file
        self.save_results()

    def save_results(self):
        """Save test results to JSON file"""
        output_file = "ai-service-test-results.json"
        try:
            with open(output_file, 'w') as f:
                json.dump(self.results, f, indent=2, default=str)
            print(f"\n{CYAN}Results saved to: {output_file}{RESET}")
        except Exception as e:
            print(f"{RED}Failed to save results: {str(e)}{RESET}")


def main():
    print(f"{CYAN}🚀 Starting AI Service Tests{RESET}")
    print(f"AI Service URL: {AI_SERVICE_URL}")
    print(f"Timestamp: {datetime.now().isoformat()}\n")

    tester = AIServiceTester()

    try:
        # Run tests in sequence
        if not tester.test_health():
            print(f"\n{RED}Cannot connect to AI service. Make sure it's running on {AI_SERVICE_URL}{RESET}")
            return

        tester.test_ready()
        tester.test_retrieve()
        tester.test_generate()

        # Print summary
        tester.print_summary()

    except KeyboardInterrupt:
        print(f"\n{YELLOW}Tests interrupted by user{RESET}")
        sys.exit(1)
    except Exception as e:
        print(f"\n{RED}Fatal error during tests: {str(e)}{RESET}")
        sys.exit(1)


if __name__ == '__main__':
    main()
