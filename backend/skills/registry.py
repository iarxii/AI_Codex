import importlib
import pkgutil
import logging
from typing import Dict, List, Optional, Type
from .base import BaseSkill

logger = logging.getLogger(__name__)

class SkillRegistry:
    """
    Registry for discovering and managing AICodex skills.
    """
    _instance = None
    _skills: Dict[str, BaseSkill] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(SkillRegistry, cls).__new__(cls)
        return cls._instance

    def register(self, skill: BaseSkill):
        """
        Registers a skill instance.
        """
        if skill.name in self._skills:
            logger.warning(f"Overwriting skill: {skill.name}")
        self._skills[skill.name] = skill
        logger.info(f"Registered skill: {skill.name}")

    def get_skill(self, name: str) -> Optional[BaseSkill]:
        """
        Retrieves a skill by name.
        """
        return self._skills.get(name)

    def get_all_skills(self) -> List[BaseSkill]:
        """
        Returns all registered skills.
        """
        return list(self._skills.values())

    def discover_builtin_skills(self):
        """
        Automatically discovers and registers skills from the builtin package.
        """
        try:
            from . import builtin
            for loader, module_name, is_pkg in pkgutil.walk_packages(builtin.__path__, builtin.__name__ + "."):
                try:
                    module = importlib.import_module(module_name)
                    for attr_name in dir(module):
                        attr = getattr(module, attr_name)
                        if (
                            isinstance(attr, type) 
                            and issubclass(attr, BaseSkill) 
                            and attr is not BaseSkill
                        ):
                            self.register(attr())
                except Exception as e:
                    logger.error(f"Failed to load skill module {module_name}: {e}")
        except Exception as e:
            logger.error(f"Skill discovery failed: {e}")

# Global singleton instance
registry = SkillRegistry()
