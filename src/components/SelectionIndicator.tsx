import React from "react";
import { motion } from "framer-motion";
import { BoundingBox, Widget, SnapTarget } from "../types/canvas";

interface SelectionIndicatorProps {
	selectedWidgets: Widget[];
	hoveredWidget: Widget | null;
	selectionBox: BoundingBox | null;
	snapTargets: SnapTarget[];
	onTransformStart?: (
		type: "resize" | "rotate",
		handle: string,
		position: { x: number; y: number },
	) => void;
}

export const SelectionIndicator: React.FC<SelectionIndicatorProps> = ({
	selectedWidgets,
	hoveredWidget,
	selectionBox,
	snapTargets,
	onTransformStart,
}) => {
	const calculateSelectionBounds = (widgets: Widget[]): BoundingBox | null => {
		if (widgets.length === 0) return null;

		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;

		widgets.forEach((widget) => {
			minX = Math.min(minX, widget.x);
			minY = Math.min(minY, widget.y);
			maxX = Math.max(maxX, widget.x + widget.width);
			maxY = Math.max(maxY, widget.y + widget.height);
		});

		return {
			x: minX,
			y: minY,
			width: maxX - minX,
			height: maxY - minY,
		};
	};

	const renderTransformHandles = (bounds: BoundingBox) => {
		const handleSize = 8;
		const handles = [
			{
				position: "nw",
				x: bounds.x - handleSize / 2,
				y: bounds.y - handleSize / 2,
			},
			{
				position: "n",
				x: bounds.x + bounds.width / 2 - handleSize / 2,
				y: bounds.y - handleSize / 2,
			},
			{
				position: "ne",
				x: bounds.x + bounds.width - handleSize / 2,
				y: bounds.y - handleSize / 2,
			},
			{
				position: "e",
				x: bounds.x + bounds.width - handleSize / 2,
				y: bounds.y + bounds.height / 2 - handleSize / 2,
			},
			{
				position: "se",
				x: bounds.x + bounds.width - handleSize / 2,
				y: bounds.y + bounds.height - handleSize / 2,
			},
			{
				position: "s",
				x: bounds.x + bounds.width / 2 - handleSize / 2,
				y: bounds.y + bounds.height - handleSize / 2,
			},
			{
				position: "sw",
				x: bounds.x - handleSize / 2,
				y: bounds.y + bounds.height - handleSize / 2,
			},
			{
				position: "w",
				x: bounds.x - handleSize / 2,
				y: bounds.y + bounds.height / 2 - handleSize / 2,
			},
		];

		const handleTransformStart = (e: React.MouseEvent, position: string) => {
			e.preventDefault();
			e.stopPropagation();
			console.log(`🔧 Transform handle clicked: ${position}`, e.target);
			console.log(`🔧 Event details:`, {
				clientX: e.clientX,
				clientY: e.clientY,
				target: e.target,
			});

			if (onTransformStart) {
				const rect = e.currentTarget.getBoundingClientRect();
				onTransformStart("resize", position, {
					x: e.clientX,
					y: e.clientY,
				});
			}
		};

		return handles.map((handle, index) => (
			<div
				key={`handle-${handle.position}`}
				className="absolute bg-white border-2 border-blue-500 cursor-pointer hover:bg-blue-50"
				style={{
					left: handle.x,
					top: handle.y,
					width: handleSize,
					height: handleSize,
					borderRadius: "2px",
					cursor: `${handle.position}-resize`,
					zIndex: 1005,
					pointerEvents: "auto",
				}}
				onMouseDown={(e) => handleTransformStart(e, handle.position)}
				onMouseUp={(e) => {
					e.preventDefault();
					e.stopPropagation();
				}}
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
				}}
			/>
		));
	};

	const renderRotationHandle = (bounds: BoundingBox) => {
		const handleSize = 12; // Larger handle for better detection
		const offset = 25;
		const x = bounds.x + bounds.width / 2 - handleSize / 2;
		const y = bounds.y - offset - handleSize / 2;

		const handleRotationStart = (e: React.MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();
			console.log("🔄 Rotation handle clicked", e.target);
			console.log("🔄 Rotation event details:", {
				clientX: e.clientX,
				clientY: e.clientY,
				target: e.target,
			});

			if (onTransformStart) {
				onTransformStart("rotate", "rotation", {
					x: e.clientX,
					y: e.clientY,
				});
			}
		};

		return (
			<>
				{/* Connection line */}
				<div
					className="absolute border-l border-blue-500 pointer-events-none"
					style={{
						left: bounds.x + bounds.width / 2,
						top: bounds.y - offset,
						height: offset,
						width: 0,
					}}
				/>
				{/* Rotation handle with larger clickable area */}
				<div
					className="absolute bg-white border-2 border-blue-500 cursor-pointer hover:bg-blue-50"
					style={{
						left: x - 4, // Expand clickable area
						top: y - 4,
						width: handleSize + 8,
						height: handleSize + 8,
						borderRadius: "50%",
						cursor: "grab",
						zIndex: 1010, // Higher z-index
						pointerEvents: "auto",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					}}
					onMouseDown={handleRotationStart}
					onMouseUp={(e) => {
						e.preventDefault();
						e.stopPropagation();
					}}
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
					}}
				>
					{/* Inner visual handle */}
					<div
						style={{
							width: handleSize,
							height: handleSize,
							backgroundColor: "white",
							border: "2px solid #3b82f6",
							borderRadius: "50%",
							pointerEvents: "none",
						}}
					/>
				</div>
			</>
		);
	};

	const selectionBounds = calculateSelectionBounds(selectedWidgets);

	return (
		<div
			className="absolute inset-0 pointer-events-none"
			style={{ zIndex: 1001 }}
		>
			{/* Hover indicator */}
			{hoveredWidget &&
				!selectedWidgets.some((w) => w.id === hoveredWidget.id) && (
					<motion.div
						className="absolute border-2 border-blue-300 pointer-events-none"
						style={{
							left: hoveredWidget.x - 2,
							top: hoveredWidget.y - 2,
							width: hoveredWidget.width + 4,
							height: hoveredWidget.height + 4,
							borderRadius: "4px",
						}}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.1, ease: "easeOut" }}
					/>
				)}

			{/* Individual widget selection outlines */}
			{selectedWidgets.map((widget) => (
				<motion.div
					key={`selection-${widget.id}`}
					className="absolute border-2 border-blue-500 pointer-events-none"
					style={{
						left: widget.x - 2,
						top: widget.y - 2,
						width: widget.width + 4,
						height: widget.height + 4,
						borderRadius: "4px",
					}}
					initial={{ opacity: 0, scale: 0.95 }}
					animate={{ opacity: 1, scale: 1 }}
					exit={{ opacity: 0, scale: 0.95 }}
					transition={{ duration: 0.15, ease: "easeOut" }}
				/>
			))}

			{/* Multi-selection bounds and handles */}
			{selectionBounds && selectedWidgets.length > 1 && (
				<motion.div
					className="absolute pointer-events-none"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.15, ease: "easeOut" }}
				>
					{/* Selection bounds outline */}
					<div
						className="absolute border-2 border-blue-600"
						style={{
							left: selectionBounds.x - 4,
							top: selectionBounds.y - 4,
							width: selectionBounds.width + 8,
							height: selectionBounds.height + 8,
							borderRadius: "6px",
							borderStyle: "dashed",
						}}
					/>

					{/* Transform handles */}
					<div className="pointer-events-auto" style={{ zIndex: 1004 }}>
						{renderTransformHandles(selectionBounds)}
						{renderRotationHandle(selectionBounds)}
					</div>

					{/* Selection count indicator */}
					<div
						className="absolute bg-blue-500 text-white px-2 py-1 rounded text-xs font-medium"
						style={{
							left: selectionBounds.x,
							top: selectionBounds.y - 28,
						}}
					>
						{selectedWidgets.length} selected
					</div>
				</motion.div>
			)}

			{/* Single selection handles */}
			{selectionBounds && selectedWidgets.length === 1 && (
				<motion.div
					className="absolute pointer-events-none"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.15, ease: "easeOut" }}
				>
					<div className="pointer-events-auto" style={{ zIndex: 1004 }}>
						{renderTransformHandles(selectionBounds)}
						{renderRotationHandle(selectionBounds)}
					</div>
				</motion.div>
			)}

			{/* Area selection box */}
			{selectionBox && (
				<motion.div
					className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none"
					style={{
						left: selectionBox.x,
						top: selectionBox.y,
						width: selectionBox.width,
						height: selectionBox.height,
						borderRadius: "2px",
					}}
					initial={{ opacity: 0, scale: 0.95 }}
					animate={{ opacity: 1, scale: 1 }}
					exit={{ opacity: 0, scale: 0.95 }}
					transition={{ duration: 0.1, ease: "easeOut" }}
				/>
			)}

			{/* Snap indicators */}
			{snapTargets.map((target, index) => (
				<motion.div
					key={`snap-${target.type}-${target.orientation}-${target.position.x}-${target.position.y}`}
					className="absolute pointer-events-none"
					style={{
						left:
							target.orientation === "vertical" ? target.position.x - 0.5 : 0,
						top:
							target.orientation === "horizontal" ? target.position.y - 0.5 : 0,
						width: target.orientation === "vertical" ? 1 : "100%",
						height: target.orientation === "horizontal" ? 1 : "100%",
						backgroundColor: target.type === "grid" ? "#ff0080" : "#00ff80",
						opacity: target.strength,
					}}
					initial={{ opacity: 0 }}
					animate={{ opacity: target.strength }}
					exit={{ opacity: 0 }}
				/>
			))}
		</div>
	);
};

export default SelectionIndicator;
