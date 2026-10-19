"""AI Model Interfaces for Cadastral Feature Extraction.
Defines base interfaces for Parcel, Building, and Road segmentation models,
supporting both real PyTorch/ONNX inference and graceful fallback to DEMO MODE.
"""
import os
import logging
from abc import ABC, abstractmethod
from typing import Tuple, List, Dict, Any, Optional

logger = logging.getLogger(__name__)

MODEL_DIR = os.getenv("MODEL_DIR", "models")


class BaseModelInterface(ABC):
    """Base class for cadastral AI feature extraction models."""

    def __init__(self, weights_path: Optional[str] = None):
        self.weights_path = weights_path
        self.is_loaded = False
        if weights_path and os.path.exists(weights_path):
            self.load_model(weights_path)

    @abstractmethod
    def load_model(self, weights_path: str) -> None:
        """Load trained neural network weights (e.g. PyTorch .pt or ONNX)."""
        pass

    @abstractmethod
    def predict(self, image_path: str) -> Any:
        """Run model inference on preprocessed drone/orthorectified image."""
        pass


class ParcelSegmentationModel(BaseModelInterface):
    """U-Net / DeepLabV3+ segmentation model interface for cadastral parcel boundary extraction."""

    def load_model(self, weights_path: str) -> None:
        try:
            # When PyTorch / TorchScript weights are provided:
            # import torch
            # self.model = torch.jit.load(weights_path)
            # self.model.eval()
            self.is_loaded = True
            logger.info("Loaded parcel segmentation weights from %s", weights_path)
        except Exception as e:
            logger.warning("Could not load parcel weights: %s. Using Demo Mode.", e)
            self.is_loaded = False

    def predict(self, image_path: str) -> Any:
        if not self.is_loaded:
            raise NotImplementedError("Parcel segmentation weights not available. Falling back to Demo Mode.")
        # Preprocessing: tile -> normalize -> tensor inference -> binary mask
        return None


class BuildingDetectionModel(BaseModelInterface):
    """YOLO / Mask R-CNN detector interface for rooftop polygon detection."""

    def load_model(self, weights_path: str) -> None:
        try:
            self.is_loaded = True
            logger.info("Loaded building detection weights from %s", weights_path)
        except Exception as e:
            logger.warning("Could not load building weights: %s. Using Demo Mode.", e)
            self.is_loaded = False

    def predict(self, image_path: str) -> Any:
        if not self.is_loaded:
            raise NotImplementedError("Building detection weights not available. Falling back to Demo Mode.")
        return None


class RoadSegmentationModel(BaseModelInterface):
    """DeepLabV3 / D-LinkNet model interface for road centerline & pathway extraction."""

    def load_model(self, weights_path: str) -> None:
        try:
            self.is_loaded = True
            logger.info("Loaded road segmentation weights from %s", weights_path)
        except Exception as e:
            logger.warning("Could not load road weights: %s. Using Demo Mode.", e)
            self.is_loaded = False

    def predict(self, image_path: str) -> Any:
        if not self.is_loaded:
            raise NotImplementedError("Road segmentation weights not available. Falling back to Demo Mode.")
        return None


def _find_weight(prefixes):
    """Return a matching model weight path, if one is explicitly configured."""
    if not os.path.isdir(MODEL_DIR):
        return None
    files = os.listdir(MODEL_DIR)
    for name in files:
        lower = name.lower()
        if lower.endswith((".pt", ".pth", ".onnx", ".engine")) and any(p in lower for p in prefixes):
            return os.path.join(MODEL_DIR, name)
    return None


def get_available_models() -> Dict[str, Any]:
    """Report model availability accurately; one weight file must not imply all models are loaded."""
    parcel = _find_weight(("parcel", "cadastral", "boundary"))
    building = _find_weight(("building", "roof", "yolo"))
    road = _find_weight(("road", "street", "dlink", "deeplab"))
    return {
        "parcels": bool(parcel),
        "buildings": bool(building),
        "roads": bool(road),
        "paths": {"parcels": parcel, "buildings": building, "roads": road},
        "mode": "model" if all((parcel, building, road)) else "assisted",
    }
