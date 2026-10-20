from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin


class FeatureFlag(Base, TimestampMixin):
    """Global dashboard feature-visibility switch.

    One row per feature key. Rows are GLOBAL (not per workspace): the owner
    hides in-progress features from every account on the app while presenting,
    and their own account (OWNER_EMAILS) always bypasses the gate. A missing
    row means the feature is visible — rows only exist once someone toggles
    or renames a feature.
    """
    __tablename__ = "feature_flags"

    key: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    visible: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    label_override: Mapped[str] = mapped_column(String(80), nullable=True)
