"""
Template Loader for Bank Statement Extraction
Loads templates from /templates/built_in/ and /templates/user_learned/

Priority:
1. User-learned templates (Tier 3) - highest priority
2. Built-in templates (official banks)
3. Fallback to Chase baseline if no match
"""

import json
from pathlib import Path
from typing import Dict, Any, List, Optional

class TemplateLoader:
    def __init__(self, templates_dir: str = "templates"):
        self.templates_dir = Path(templates_dir)
        self.built_in_dir = self.templates_dir / "built_in"
        self.user_learned_dir = self.templates_dir / "user_learned"
        
        # Create directories if they don't exist
        self.built_in_dir.mkdir(parents=True, exist_ok=True)
        self.user_learned_dir.mkdir(parents=True, exist_ok=True)
        
        self.templates: Dict[str, Dict[str, Any]] = {}
        self.load_all_templates()
    
    def load_all_templates(self) -> Dict[str, Dict[str, Any]]:
        """Load all templates from built_in and user_learned directories"""
        print("📂 Loading bank templates...")
        
        # Load built-in templates first
        built_in_count = self._load_templates_from_dir(self.built_in_dir, "built-in")
        
        # Load user-learned templates (override built-in if duplicate)
        user_count = self._load_templates_from_dir(self.user_learned_dir, "user-learned")
        
        print(f"✅ Loaded {built_in_count} built-in templates + {user_count} user-learned templates")
        print(f"📋 Available banks: {', '.join(self.templates.keys())}")
        
        return self.templates
    
    def _load_templates_from_dir(self, directory: Path, source: str) -> int:
        """Load all JSON templates from a directory"""
        if not directory.exists():
            return 0
        
        count = 0
        for json_file in directory.glob("*.json"):
            try:
                with json_file.open() as f:
                    template = json.load(f)
                
                # Validate required fields
                if not self._validate_template(template):
                    print(f"⚠️  Skipping invalid template: {json_file.name}")
                    continue
                
                bank_key = template["bank_key"]
                template["_source"] = source
                template["_file"] = str(json_file)
                
                # User-learned templates override built-in
                if bank_key in self.templates and source == "user-learned":
                    print(f"🔄 User template overrides built-in: {bank_key}")
                
                self.templates[bank_key] = template
                count += 1
                
                print(f"  ✅ Loaded {source}: {template['bank_name']} ({bank_key})")
                
            except json.JSONDecodeError as e:
                print(f"❌ Failed to parse {json_file.name}: {e}")
            except Exception as e:
                print(f"❌ Error loading {json_file.name}: {e}")
        
        return count
    
    def _validate_template(self, template: Dict[str, Any]) -> bool:
        """Validate that template has all required fields"""
        required_fields = [
            "bank_key",
            "bank_name",
            "statement_model",
            "columns",
            "detection_keywords"
        ]
        
        for field in required_fields:
            if field not in template:
                print(f"⚠️  Missing required field: {field}")
                return False
        
        # Validate columns
        columns = template.get("columns", {})
        if template["statement_model"] == "running_balance":
            required_cols = ["date", "description", "amount", "balance"]
        elif template["statement_model"] == "soll_haben":
            required_cols = ["date", "description", "soll", "haben"]
        else:
            required_cols = ["date", "description"]
        
        for col in required_cols:
            if col not in columns:
                print(f"⚠️  Missing column: {col}")
                return False
            
            # Validate x_min/x_max
            if "x_min" not in columns[col] or "x_max" not in columns[col]:
                print(f"⚠️  Column {col} missing x_min or x_max")
                return False
        
        return True
    
    def get_template(self, bank_key: str) -> Optional[Dict[str, Any]]:
        """Get template by bank key"""
        return self.templates.get(bank_key)
    
    def get_all_templates(self) -> Dict[str, Dict[str, Any]]:
        """Get all loaded templates"""
        return self.templates
    
    def detect_bank(self, pdf_text: str) -> Optional[str]:
        """
        Detect bank from PDF text using detection keywords
        Returns bank_key if found, None otherwise
        """
        pdf_text_lower = pdf_text.lower()
        
        # Check user-learned templates first (higher priority)
        for bank_key, template in self.templates.items():
            if template.get("_source") == "user-learned":
                for keyword in template["detection_keywords"]:
                    if keyword.lower() in pdf_text_lower:
                        print(f"🔍 Detected bank (user template): {template['bank_name']}")
                        return bank_key
        
        # Then check built-in templates
        for bank_key, template in self.templates.items():
            if template.get("_source") == "built-in":
                for keyword in template["detection_keywords"]:
                    if keyword.lower() in pdf_text_lower:
                        print(f"🔍 Detected bank (built-in): {template['bank_name']}")
                        return bank_key
        
        return None
    
    def save_user_template(self, template: Dict[str, Any]) -> bool:
        """
        Save a user-learned template (Tier 3)
        Returns True if saved successfully
        """
        try:
            # Validate template
            if not self._validate_template(template):
                print("❌ Cannot save invalid template")
                return False
            
            bank_key = template["bank_key"]
            template["_source"] = "user-learned"
            
            # Save to user_learned directory
            file_path = self.user_learned_dir / f"{bank_key}.json"
            
            with file_path.open("w") as f:
                json.dump(template, f, indent=2)
            
            # Add to loaded templates
            template["_file"] = str(file_path)
            self.templates[bank_key] = template
            
            print(f"✅ Saved user template: {template['bank_name']} → {file_path}")
            return True
            
        except Exception as e:
            print(f"❌ Failed to save template: {e}")
            return False
    
    def list_banks(self) -> List[str]:
        """List all available bank names"""
        return [t["bank_name"] for t in self.templates.values()]
    
    def get_template_info(self, bank_key: str) -> Optional[Dict[str, str]]:
        """Get metadata about a template (for UI display)"""
        template = self.templates.get(bank_key)
        if not template:
            return None
        
        return {
            "bank_key": template["bank_key"],
            "bank_name": template["bank_name"],
            "version": template.get("version", "unknown"),
            "source": template.get("_source", "unknown"),
            "created_by": template.get("created_by", "unknown"),
            "last_updated": template.get("last_updated", "unknown"),
            "description": template.get("description", ""),
            "currency": template.get("currency", "USD"),
            "statement_model": template["statement_model"]
        }


# Global loader instance
_loader = None

def get_loader() -> TemplateLoader:
    """Get singleton template loader instance"""
    global _loader
    if _loader is None:
        _loader = TemplateLoader()
    return _loader

def load_all_templates() -> Dict[str, Dict[str, Any]]:
    """Load all templates (convenience function for app.py)"""
    return get_loader().get_all_templates()

def get_template(bank_key: str) -> Optional[Dict[str, Any]]:
    """Get template by bank key (convenience function)"""
    return get_loader().get_template(bank_key)

def detect_bank(pdf_text: str) -> Optional[str]:
    """Detect bank from PDF text (convenience function)"""
    return get_loader().detect_bank(pdf_text)

def save_user_template(template: Dict[str, Any]) -> bool:
    """Save user-learned template (convenience function for Tier 3)"""
    return get_loader().save_user_template(template)


if __name__ == "__main__":
    # Test the loader
    print("=" * 70)
    print("TESTING TEMPLATE LOADER")
    print("=" * 70)
    
    loader = TemplateLoader()
    
    print("\n📋 Available Templates:")
    for bank_key, template in loader.get_all_templates().items():
        info = loader.get_template_info(bank_key)
        print(f"\n  🏦 {info['bank_name']}")
        print(f"     Key: {info['bank_key']}")
        print(f"     Source: {info['source']}")
        print(f"     Version: {info['version']}")
        print(f"     Model: {info['statement_model']}")
        print(f"     Currency: {info['currency']}")
    
    print("\n" + "=" * 70)
    print("✅ Template loader ready!")
    print("=" * 70)
