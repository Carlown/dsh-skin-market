window.__ModuleLoader__.load({
	id: "dsh-skin-market",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		_deepseek_ai_dsh_client_ui_primitives = __toESM(_deepseek_ai_dsh_client_ui_primitives, 1);
		let react_dom = require("react-dom");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region node_modules/@phosphor-icons/react/dist/defs/TShirt.es.js
		const e = /* @__PURE__ */ new Map([
			["bold", /* @__PURE__ */ react.createElement(react.Fragment, null, /* @__PURE__ */ react.createElement("path", { d: "M246.17,57.9,198.09,29.65h0A11.9,11.9,0,0,0,192,28H160a12,12,0,0,0-12,12,20,20,0,0,1-40,0A12,12,0,0,0,96,28H64a11.9,11.9,0,0,0-6.07,1.66h0L9.83,57.9A20.18,20.18,0,0,0,2,84l17.9,36.8A19.62,19.62,0,0,0,37.67,132H52v76a20,20,0,0,0,20,20H184a20,20,0,0,0,20-20V132h14.32a19.64,19.64,0,0,0,17.75-11.17L254,84A20.18,20.18,0,0,0,246.17,57.9ZM40.37,108,25.16,76.73,52,61v47ZM180,204H76V52h9.67a44,44,0,0,0,84.68,0H180Zm35.62-96H204V61l26.83,15.76Z" }))],
			["duotone", /* @__PURE__ */ react.createElement(react.Fragment, null, /* @__PURE__ */ react.createElement("path", {
				d: "M247.11,78.77l-19.27,36.81a8.44,8.44,0,0,1-7.5,4.42H192V40l51.78,28.25A7.81,7.81,0,0,1,247.11,78.77Zm-238.22,0,19.27,36.81a8.44,8.44,0,0,0,7.5,4.42H64V40L12.22,68.25A7.81,7.81,0,0,0,8.89,78.77Z",
				opacity: "0.2"
			}), /* @__PURE__ */ react.createElement("path", { d: "M247.59,61.22,195.83,33A8,8,0,0,0,192,32H160a8,8,0,0,0-8,8,24,24,0,0,1-48,0,8,8,0,0,0-8-8H64a8,8,0,0,0-3.84,1L8.41,61.22A15.76,15.76,0,0,0,1.82,82.48l19.27,36.81A16.37,16.37,0,0,0,35.67,128H56v80a16,16,0,0,0,16,16H184a16,16,0,0,0,16-16V128h20.34a16.37,16.37,0,0,0,14.58-8.71l19.27-36.81A15.76,15.76,0,0,0,247.59,61.22ZM35.67,112a.62.62,0,0,1-.41-.13L16.09,75.26,56,53.48V112ZM184,208H72V48h16.8a40,40,0,0,0,78.38,0H184Zm36.75-96.14a.55.55,0,0,1-.41.14H200V53.48l39.92,21.78Z" }))],
			["fill", /* @__PURE__ */ react.createElement(react.Fragment, null, /* @__PURE__ */ react.createElement("path", { d: "M247.59,61.22,195.83,33A8,8,0,0,0,192,32H160a8,8,0,0,0-8,8,24,24,0,0,1-48,0,8,8,0,0,0-8-8H64a8,8,0,0,0-3.84,1L8.41,61.22A15.76,15.76,0,0,0,1.82,82.48l19.27,36.81A16.37,16.37,0,0,0,35.67,128H56v80a16,16,0,0,0,16,16H184a16,16,0,0,0,16-16V128h20.34a16.37,16.37,0,0,0,14.58-8.71l19.27-36.81A15.76,15.76,0,0,0,247.59,61.22ZM35.67,112a.62.62,0,0,1-.41-.13L16.09,75.26,56,53.48V112Zm185.07-.14a.55.55,0,0,1-.41.14H200V53.48l39.92,21.78Z" }))],
			["light", /* @__PURE__ */ react.createElement(react.Fragment, null, /* @__PURE__ */ react.createElement("path", { d: "M246.64,63,194.87,34.74A5.93,5.93,0,0,0,192,34H160a6,6,0,0,0-6,6,26,26,0,0,1-52,0,6,6,0,0,0-6-6H64a5.93,5.93,0,0,0-2.88.74L9.36,63A13.77,13.77,0,0,0,3.58,81.55l19.28,36.81A14.38,14.38,0,0,0,35.67,126H58v82a14,14,0,0,0,14,14H184a14,14,0,0,0,14-14V126h22.34a14.38,14.38,0,0,0,12.81-7.64l19.28-36.81A13.77,13.77,0,0,0,246.64,63Zm-211,51a2.42,2.42,0,0,1-2.18-1.21L14.21,76a1.82,1.82,0,0,1,.9-2.47L58,50.11V114ZM186,208a2,2,0,0,1-2,2H72a2,2,0,0,1-2-2V46H90.48a38,38,0,0,0,75,0H186Zm55.8-132-19.28,36.8a2.42,2.42,0,0,1-2.18,1.21H198V50.11l42.9,23.4A1.83,1.83,0,0,1,241.79,76Z" }))],
			["regular", /* @__PURE__ */ react.createElement(react.Fragment, null, /* @__PURE__ */ react.createElement("path", { d: "M247.59,61.22,195.83,33A8,8,0,0,0,192,32H160a8,8,0,0,0-8,8,24,24,0,0,1-48,0,8,8,0,0,0-8-8H64a8,8,0,0,0-3.84,1L8.41,61.22A15.76,15.76,0,0,0,1.82,82.48l19.27,36.81A16.37,16.37,0,0,0,35.67,128H56v80a16,16,0,0,0,16,16H184a16,16,0,0,0,16-16V128h20.34a16.37,16.37,0,0,0,14.58-8.71l19.27-36.81A15.76,15.76,0,0,0,247.59,61.22ZM35.67,112a.62.62,0,0,1-.41-.13L16.09,75.26,56,53.48V112ZM184,208H72V48h16.8a40,40,0,0,0,78.38,0H184Zm36.75-96.14a.55.55,0,0,1-.41.14H200V53.48l39.92,21.78Z" }))],
			["thin", /* @__PURE__ */ react.createElement(react.Fragment, null, /* @__PURE__ */ react.createElement("path", { d: "M245.68,64.73,193.91,36.49h0A4,4,0,0,0,192,36H160a4,4,0,0,0-4,4,28,28,0,0,1-56,0,4,4,0,0,0-4-4H64a4,4,0,0,0-1.9.5h0L10.32,64.73a11.79,11.79,0,0,0-5,15.89l19.28,36.81a12.37,12.37,0,0,0,11,6.57H60v84a12,12,0,0,0,12,12H184a12,12,0,0,0,12-12V124h24.33a12.37,12.37,0,0,0,11-6.57l19.28-36.81A11.79,11.79,0,0,0,245.68,64.73ZM35.67,116a4.46,4.46,0,0,1-4-2.28L12.44,76.91a3.79,3.79,0,0,1,1.71-5.15L60,46.74V116ZM188,208a4,4,0,0,1-4,4H72a4,4,0,0,1-4-4V44H92.22a36,36,0,0,0,71.56,0H188ZM243.56,76.91l-19.27,36.81a4.46,4.46,0,0,1-4,2.28H196V46.74l45.85,25A3.79,3.79,0,0,1,243.56,76.91Z" }))]
		]);
		//#endregion
		//#region node_modules/@phosphor-icons/react/dist/lib/context.es.js
		const o = (0, react.createContext)({
			color: "currentColor",
			size: "1em",
			weight: "regular",
			mirrored: !1
		});
		//#endregion
		//#region node_modules/@phosphor-icons/react/dist/lib/IconBase.es.js
		const p = react.forwardRef((s, a) => {
			const { alt: n, color: r, size: t, weight: o$1, mirrored: c, children: i, weights: m, ...x } = s, { color: d = "currentColor", size: l, weight: f = "regular", mirrored: g = !1, ...w } = react.useContext(o);
			return /* @__PURE__ */ react.createElement("svg", {
				ref: a,
				xmlns: "http://www.w3.org/2000/svg",
				width: t != null ? t : l,
				height: t != null ? t : l,
				fill: r != null ? r : d,
				viewBox: "0 0 256 256",
				transform: c || g ? "scale(-1, 1)" : void 0,
				...w,
				...x
			}, !!n && /* @__PURE__ */ react.createElement("title", null, n), i, m.get(o$1 != null ? o$1 : f));
		});
		p.displayName = "IconBase";
		//#endregion
		//#region node_modules/@phosphor-icons/react/dist/csr/TShirt.es.js
		const r = react.forwardRef((t, e$1) => /* @__PURE__ */ react.createElement(p, {
			ref: e$1,
			...t,
			weights: e
		}));
		r.displayName = "TShirtIcon";
		//#endregion
		//#region node_modules/@primer/octicons-react/dist/renderOcticon-DuMQdmQC.mjs
		function _typeof(o) {
			"@babel/helpers - typeof";
			return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o) {
				return typeof o;
			} : function(o) {
				return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o;
			}, _typeof(o);
		}
		var _excluded = [
			"aria-hidden",
			"aria-label",
			"aria-labelledby",
			"tabIndex",
			"className",
			"fill",
			"size",
			"verticalAlign",
			"id",
			"title",
			"style"
		];
		function _extends() {
			return _extends = Object.assign ? Object.assign.bind() : function(n) {
				for (var e = 1; e < arguments.length; e++) {
					var t = arguments[e];
					for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
				}
				return n;
			}, _extends.apply(null, arguments);
		}
		function ownKeys(e, r) {
			var t = Object.keys(e);
			if (Object.getOwnPropertySymbols) {
				var o = Object.getOwnPropertySymbols(e);
				r && (o = o.filter(function(r) {
					return Object.getOwnPropertyDescriptor(e, r).enumerable;
				})), t.push.apply(t, o);
			}
			return t;
		}
		function _objectSpread(e) {
			for (var r = 1; r < arguments.length; r++) {
				var t = null != arguments[r] ? arguments[r] : {};
				r % 2 ? ownKeys(Object(t), !0).forEach(function(r) {
					_defineProperty(e, r, t[r]);
				}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function(r) {
					Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r));
				});
			}
			return e;
		}
		function _defineProperty(e, r, t) {
			return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
				value: t,
				enumerable: !0,
				configurable: !0,
				writable: !0
			}) : e[r] = t, e;
		}
		function _toPropertyKey(t) {
			var i = _toPrimitive(t, "string");
			return "symbol" == _typeof(i) ? i : i + "";
		}
		function _toPrimitive(t, r) {
			if ("object" != _typeof(t) || !t) return t;
			var e = t[Symbol.toPrimitive];
			if (void 0 !== e) {
				var i = e.call(t, r || "default");
				if ("object" != _typeof(i)) return i;
				throw new TypeError("@@toPrimitive must return a primitive value.");
			}
			return ("string" === r ? String : Number)(t);
		}
		function _objectWithoutProperties(e, t) {
			if (null == e) return {};
			var o, r, i = _objectWithoutPropertiesLoose(e, t);
			if (Object.getOwnPropertySymbols) {
				var n = Object.getOwnPropertySymbols(e);
				for (r = 0; r < n.length; r++) o = n[r], -1 === t.indexOf(o) && {}.propertyIsEnumerable.call(e, o) && (i[o] = e[o]);
			}
			return i;
		}
		function _objectWithoutPropertiesLoose(r, e) {
			if (null == r) return {};
			var t = {};
			for (var n in r) if ({}.hasOwnProperty.call(r, n)) {
				if (-1 !== e.indexOf(n)) continue;
				t[n] = r[n];
			}
			return t;
		}
		var sizeMap = {
			small: 16,
			medium: 32,
			large: 64
		};
		function renderOcticon(_ref, forwardedRef, defaultClassName, svgDataByHeight, heights) {
			var ariaHidden = _ref["aria-hidden"], ariaLabel = _ref["aria-label"], arialabelledby = _ref["aria-labelledby"], tabIndex = _ref.tabIndex, _ref$className = _ref.className, className = _ref$className === void 0 ? "" : _ref$className, _ref$fill = _ref.fill, fill = _ref$fill === void 0 ? "currentColor" : _ref$fill, _ref$size = _ref.size, size = _ref$size === void 0 ? 16 : _ref$size, _ref$verticalAlign = _ref.verticalAlign, verticalAlign = _ref$verticalAlign === void 0 ? "text-bottom" : _ref$verticalAlign, id = _ref.id, title = _ref.title, style = _ref.style, rest = _objectWithoutProperties(_ref, _excluded);
			var height = sizeMap[size] || size;
			var naturalHeight = closestNaturalHeight(heights, height);
			var naturalWidth = svgDataByHeight[naturalHeight].width;
			var width = height * (naturalWidth / naturalHeight);
			var path = svgDataByHeight[naturalHeight].path;
			var labelled = ariaLabel || arialabelledby;
			var computedAriaHidden = ariaHidden === void 0 ? labelled ? void 0 : "true" : ariaHidden;
			var role = labelled && computedAriaHidden !== "true" ? "img" : void 0;
			return /*#__PURE__*/ react.default.createElement("svg", _extends({
				ref: forwardedRef,
				"data-component": "Octicon"
			}, rest, {
				"aria-hidden": computedAriaHidden,
				tabIndex,
				focusable: tabIndex >= 0 ? "true" : "false",
				"aria-label": ariaLabel,
				"aria-labelledby": arialabelledby,
				className: "".concat(defaultClassName, " ").concat(className).trim(),
				role,
				viewBox: "0 0 ".concat(naturalWidth, " ").concat(naturalHeight),
				width,
				height,
				fill,
				id,
				display: "inline-block",
				overflow: "visible",
				style: _objectSpread({ verticalAlign }, style)
			}), title ? /*#__PURE__*/ react.default.createElement("title", null, title) : null, path);
		}
		function closestNaturalHeight(naturalHeights, height) {
			return naturalHeights.map(function(naturalHeight) {
				return parseInt(naturalHeight, 10);
			}).reduce(function(acc, naturalHeight) {
				return naturalHeight <= height ? naturalHeight : acc;
			}, naturalHeights[0]);
		}
		//#endregion
		//#region node_modules/@primer/octicons-react/dist/icons/MarkGithubIcon.mjs
		var heights$1 = ["16", "24"];
		var svgDataByHeight$1 = {
			"16": {
				"width": 16,
				"path": /*#__PURE__*/ react.default.createElement("path", { d: "M6.766 11.328c-2.063-.25-3.516-1.734-3.516-3.656 0-.781.281-1.625.75-2.188-.203-.515-.172-1.609.063-2.062.625-.078 1.468.25 1.968.703.594-.187 1.219-.281 1.985-.281.765 0 1.39.094 1.953.265.484-.437 1.344-.765 1.969-.687.218.422.25 1.515.046 2.047.5.593.766 1.39.766 2.203 0 1.922-1.453 3.375-3.547 3.64.531.344.89 1.094.89 1.954v1.625c0 .468.391.734.86.547C13.781 14.359 16 11.53 16 8.03 16 3.61 12.406 0 7.984 0 3.563 0 0 3.61 0 8.031a7.88 7.88 0 0 0 5.172 7.422c.422.156.828-.125.828-.547v-1.25c-.219.094-.5.156-.75.156-1.031 0-1.64-.562-2.078-1.609-.172-.422-.36-.672-.719-.719-.187-.015-.25-.093-.25-.187 0-.188.313-.328.625-.328.453 0 .844.281 1.25.86.313.452.64.655 1.031.655s.641-.14 1-.5c.266-.265.47-.5.657-.656" })
			},
			"24": {
				"width": 24,
				"path": /*#__PURE__*/ react.default.createElement("path", { d: "M10.226 17.284c-2.965-.36-5.054-2.493-5.054-5.256 0-1.123.404-2.336 1.078-3.144-.292-.741-.247-2.314.09-2.965.898-.112 2.111.36 2.83 1.01.853-.269 1.752-.404 2.853-.404 1.1 0 1.999.135 2.807.382.696-.629 1.932-1.1 2.83-.988.315.606.36 2.179.067 2.942.72.854 1.101 2 1.101 3.167 0 2.763-2.089 4.852-5.098 5.234.763.494 1.28 1.572 1.28 2.807v2.336c0 .674.561 1.056 1.235.786 4.066-1.55 7.255-5.615 7.255-10.646C23.5 6.188 18.334 1 11.978 1 5.62 1 .5 6.188.5 12.545c0 4.986 3.167 9.12 7.435 10.669.606.225 1.19-.18 1.19-.786V20.63a2.9 2.9 0 0 1-1.078.224c-1.483 0-2.359-.808-2.987-2.313-.247-.607-.517-.966-1.034-1.033-.27-.023-.359-.135-.359-.27 0-.27.45-.471.898-.471.652 0 1.213.404 1.797 1.235.45.651.921.943 1.483.943.561 0 .92-.202 1.437-.719.382-.381.674-.718.944-.943" })
			}
		};
		var MarkGithubIcon = /*#__PURE__*/ react.default.forwardRef(function(props, ref) {
			return renderOcticon(props, ref, "octicon octicon-mark-github", svgDataByHeight$1, heights$1);
		});
		MarkGithubIcon.displayName = "MarkGithubIcon";
		//#endregion
		//#region node_modules/@primer/octicons-react/dist/icons/StarIcon.mjs
		var heights = ["16", "24"];
		var svgDataByHeight = {
			"16": {
				"width": 16,
				"path": /*#__PURE__*/ react.default.createElement("path", { d: "M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Zm0 2.445L6.615 5.5a.75.75 0 0 1-.564.41l-3.097.45 2.24 2.184a.75.75 0 0 1 .216.664l-.528 3.084 2.769-1.456a.75.75 0 0 1 .698 0l2.77 1.456-.53-3.084a.75.75 0 0 1 .216-.664l2.24-2.183-3.096-.45a.75.75 0 0 1-.564-.41L8 2.694Z" })
			},
			"24": {
				"width": 24,
				"path": /*#__PURE__*/ react.default.createElement("path", { d: "M12 .25a.75.75 0 0 1 .673.418l3.058 6.197 6.839.994a.75.75 0 0 1 .415 1.279l-4.948 4.823 1.168 6.811a.751.751 0 0 1-1.088.791L12 18.347l-6.117 3.216a.75.75 0 0 1-1.088-.79l1.168-6.812-4.948-4.823a.75.75 0 0 1 .416-1.28l6.838-.993L11.328.668A.75.75 0 0 1 12 .25Zm0 2.445L9.44 7.882a.75.75 0 0 1-.565.41l-5.725.832 4.143 4.038a.748.748 0 0 1 .215.664l-.978 5.702 5.121-2.692a.75.75 0 0 1 .698 0l5.12 2.692-.977-5.702a.748.748 0 0 1 .215-.664l4.143-4.038-5.725-.831a.75.75 0 0 1-.565-.41L12 2.694Z" })
			}
		};
		var StarIcon = /*#__PURE__*/ react.default.forwardRef(function(props, ref) {
			return renderOcticon(props, ref, "octicon octicon-star", svgDataByHeight, heights);
		});
		StarIcon.displayName = "StarIcon";
		//#endregion
		//#region \0dsh-skin-market-css:/Users/leon/Code/liang-intensity-calibrator/code/dsh-skin-market/src/client/SkinMarket.module.css.mjs
		const css = ".VqXecW_root{box-sizing:border-box;width:100%;height:100%;min-height:0;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);grid-template-columns:330px minmax(0,1fr);display:grid;overflow:hidden}.VqXecW_settingsNavIcon{flex:none;justify-content:center;align-items:center;width:16px;height:16px;display:inline-flex}.VqXecW_settingsNavIcon svg{width:16px;height:16px;display:block}svg[data-dsh-skin-market-default-icon=hidden]{display:none}.VqXecW_srOnly{clip:rect(0, 0, 0, 0)!important;white-space:nowrap!important;border:0!important;width:1px!important;height:1px!important;margin:-1px!important;padding:0!important;position:absolute!important;overflow:hidden!important}.VqXecW_catalog{border-right:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);flex-direction:column;min-width:0;display:flex}.VqXecW_catalogHeader{border-bottom:1px solid var(--dsw-alias-border-l2);flex-direction:column;gap:14px;padding:24px 22px 10px;display:flex}.VqXecW_catalogHeader h2,.VqXecW_detail h2,.VqXecW_detail h3,.VqXecW_catalogHeader p,.VqXecW_detail p{margin:0}.VqXecW_catalogHeader h2{margin-bottom:2px;font-size:20px;font-weight:600;line-height:28px}.VqXecW_catalogHeader p{color:var(--dsw-alias-label-secondary);margin-top:2px;font-size:12px;line-height:18px}.VqXecW_catalogTitle{justify-content:space-between;align-items:center;gap:12px;display:flex}.VqXecW_catalogHeader>span{height:48px;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l2);background:0 0;border-radius:10px;align-items:center;gap:8px;padding:0 14px;display:flex}.VqXecW_catalogHeader>span:focus-within{border-color:var(--dsw-alias-border-l1)}.VqXecW_catalogHeader>span input{min-width:0;color:var(--dsw-alias-label-primary);background:0 0;border:0;outline:0;flex:1}.VqXecW_catalogHeader>span input::placeholder{color:var(--dsw-alias-label-caption)}.VqXecW_filterBar{justify-content:space-between;align-items:center;gap:8px;display:flex}.VqXecW_filters{flex-wrap:wrap;gap:4px;display:flex}.VqXecW_root .VqXecW_filters .VqXecW_filterPill{border-radius:14px;justify-content:center;align-items:center;height:28px;padding:0 11px;font-size:12px;line-height:18px;display:inline-flex;color:var(--dsw-alias-label-secondary)!important;background:0 0!important;border:1px solid #0000!important}.VqXecW_root .VqXecW_filters .VqXecW_filterPill:hover{background:var(--dsw-alias-interactive-bg-hover)!important}.VqXecW_root .VqXecW_filters .VqXecW_filterPill[data-active=true]{color:var(--dsw-alias-label-primary)!important;border-color:var(--dsw-alias-button-ghost-active-border,var(--dsw-alias-border-l1))!important;background:var(--dsw-alias-button-ghost-active-fill,var(--dsw-alias-interactive-bg-hover))!important}.VqXecW_staticPill{height:24px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border:none;border-radius:12px;align-items:center;gap:4px;padding:0 8px;font-size:12px;line-height:18px;display:inline-flex}.VqXecW_sortButton{cursor:pointer;white-space:nowrap;height:28px;color:var(--dsw-alias-label-secondary);background:0 0;border:0;border-radius:14px;justify-content:center;align-items:center;gap:4px;padding:0 10px;font-size:12px;line-height:18px;display:inline-flex}.VqXecW_sortButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.VqXecW_skinList{overscroll-behavior:contain;scrollbar-gutter:stable;touch-action:pan-y;-webkit-overflow-scrolling:touch;flex-direction:column;flex:1 1 0;gap:4px;height:0;min-height:0;margin:0;padding:8px 12px 16px;display:flex;overflow:hidden auto}.VqXecW_skinCard{box-sizing:border-box;cursor:pointer;text-align:left;width:100%;min-height:72px;color:inherit;font:inherit;background:0 0;border:0;border-radius:8px;align-items:center;gap:12px;padding:8px;display:flex}.VqXecW_skinCard:hover{background:var(--dsw-specific-sidebar-nav-item-hover,var(--dsw-alias-interactive-bg-hover))}.VqXecW_externalPlugin{cursor:default;border:1px dashed var(--dsw-alias-border-l2);min-height:58px}.VqXecW_skinCard[data-selected=true]{background:var(--dsw-specific-sidebar-nav-item-active,var(--dsw-alias-button-ghost-active-fill));box-shadow:inset 0 0 0 1px var(--dsw-alias-button-ghost-active-border)}.VqXecW_skinCard>img{object-fit:cover;opacity:.35;background:var(--dsw-alias-bg-layer-3);border-radius:7px;flex:none;width:56px;height:56px;transition:opacity .18s ease-out;display:block}.VqXecW_skinCard>img[data-loaded=true]{opacity:1}.VqXecW_skinCard>img[data-failed=true]{opacity:0}.VqXecW_skinCardBody{flex-direction:column;flex:1;min-width:0;display:flex}.VqXecW_cardTitle{white-space:nowrap;text-overflow:ellipsis;font-size:14px;font-weight:400;line-height:22px;overflow:hidden}.VqXecW_cardMetaLine{min-width:0;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));align-items:center;gap:8px;font-size:12px;line-height:18px;display:flex}.VqXecW_cardMeta{white-space:nowrap;text-overflow:ellipsis;min-width:0;overflow:hidden}.VqXecW_cardStars{white-space:nowrap;flex:none;align-items:center;gap:3px;display:inline-flex}.VqXecW_cardStatus{height:20px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));background:var(--dsw-alias-bg-layer-1);white-space:nowrap;border:0;border-radius:5px;flex:none;align-items:center;padding:0 7px;font-size:10px;line-height:16px;display:inline-flex}.VqXecW_cardStatusUpdate{color:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary));background:color-mix(in srgb, var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary)) 10%, transparent)}.VqXecW_listSkeleton{gap:4px;display:grid}.VqXecW_skeletonCard{align-items:center;gap:12px;min-height:72px;padding:8px;display:flex}.VqXecW_skeletonCard>span:first-child{border-radius:7px;flex:none;width:56px;height:56px}.VqXecW_skeletonCard>span:nth-child(2){flex:1;gap:8px;min-width:0;display:grid}.VqXecW_skeletonCard>span:nth-child(2) i:first-child{width:62%;height:14px}.VqXecW_skeletonCard>span:nth-child(2) i:last-child{width:42%;height:10px}.VqXecW_skeletonCard>i{border-radius:5px;width:42px;height:18px}.VqXecW_skeletonCard span:first-child,.VqXecW_skeletonCard i,.VqXecW_detailSkeleton span,.VqXecW_detailSkeleton i,.VqXecW_loadMoreHint span{background:linear-gradient(90deg, var(--dsw-alias-bg-layer-1) 25%, var(--dsw-alias-interactive-bg-hover) 50%, var(--dsw-alias-bg-layer-1) 75%);background-size:200% 100%;border-radius:6px;animation:1.4s ease-in-out infinite VqXecW_skeletonShimmer;display:block}.VqXecW_loadMoreHint{gap:6px;padding:10px 8px 2px;display:grid}.VqXecW_loadMoreHint span{height:4px}.VqXecW_loadMoreHint span:first-child{width:72%}.VqXecW_loadMoreHint span:last-child{width:46%}.VqXecW_detailSkeleton{gap:16px;display:grid}.VqXecW_detailSkeleton>div{gap:20px;display:flex}.VqXecW_detailSkeleton>div span{border-radius:9px;flex:none;width:138px;height:138px}.VqXecW_detailSkeleton>div i{width:min(420px,58%);height:72px;margin-top:12px}.VqXecW_detailSkeleton>span{width:100%;height:42px}.VqXecW_detailSkeleton>span:nth-child(3){height:min(340px,34vh)}.VqXecW_detailSkeleton>span:last-child{width:76%;height:110px}.VqXecW_detail{flex-direction:column;gap:14px;min-width:0;min-height:0;padding:32px 28px 28px;display:flex;overflow-y:auto}.VqXecW_detail>*{flex:none}.VqXecW_mobileBack.VqXecW_nativeOutline{order:0;align-self:flex-start;display:none}.VqXecW_hero{aspect-ratio:16/8;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:10px;order:4;width:100%;position:relative;overflow:hidden}.VqXecW_hero img{object-fit:cover;width:100%;height:100%;display:block}.VqXecW_thumbnails{order:5;gap:8px;display:flex;overflow-x:auto}.VqXecW_thumbnails button{cursor:pointer;border:1px solid var(--dsw-alias-border-l2);opacity:.62;background:0 0;border-radius:8px;flex:none;width:112px;padding:0;overflow:hidden}.VqXecW_thumbnails button[data-selected=true]{border-color:var(--dsw-alias-brand-primary);opacity:1}.VqXecW_thumbnails img{aspect-ratio:16/9;object-fit:cover;width:100%;display:block}.VqXecW_detailHeader{border-bottom:1px solid var(--dsw-alias-border-l2);order:1;grid-template-columns:138px minmax(0,1fr);align-items:start;gap:22px;padding:0 4px 16px;display:grid}.VqXecW_skinAvatar{object-fit:cover;background:var(--dsw-alias-bg-layer-1);border-radius:9px;width:138px;height:138px;display:block}.VqXecW_titleBlock{min-width:0;padding-top:10px}.VqXecW_titleBlock h2{letter-spacing:-.01em;font-size:23px;font-weight:620;line-height:31px}.VqXecW_titleBlock .VqXecW_author{color:var(--dsw-alias-label-secondary);margin-top:2px;font-size:13px;line-height:20px}.VqXecW_titleBlock .VqXecW_description{max-width:520px;color:var(--dsw-alias-label-secondary);margin-top:10px;font-size:13px;line-height:21px}.VqXecW_titleBlock .VqXecW_version{min-width:0;color:var(--dsw-alias-label-caption);align-items:center;gap:7px;margin-top:8px;font-size:12px;line-height:22px;display:flex}.VqXecW_status{height:20px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);white-space:nowrap;border:0;border-radius:10px;align-items:center;padding:0 7px;font-size:11px;line-height:18px;display:inline-flex}.VqXecW_statusActive{color:var(--dsw-alias-state-success-primary);background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 10%, transparent)}.VqXecW_actionRow{border-bottom:1px solid var(--dsw-alias-border-l2);flex-wrap:wrap;order:2;align-items:center;gap:9px;min-height:42px;padding:0 4px 12px;display:flex}.VqXecW_stars{color:var(--dsw-alias-label-secondary);white-space:nowrap;flex:none;align-items:center;gap:5px;font-size:12px;line-height:20px;display:inline-flex}.VqXecW_actionDivider{background:var(--dsw-alias-border-l2);width:1px;height:22px;margin:0 3px}.VqXecW_repoMeta{flex:220px;align-items:center;gap:10px;min-width:0;display:flex}.VqXecW_repoLink{min-width:0;color:var(--dsw-alias-link-primary,var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary)));align-items:center;gap:5px;font-size:12px;line-height:20px;text-decoration:none;display:inline-flex}.VqXecW_repoLink>svg{flex:none}.VqXecW_repoLink>span{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}.VqXecW_repoLink:hover{text-decoration:underline}.VqXecW_nativePrimary,.VqXecW_nativeOutline{cursor:pointer;height:28px;font:inherit;border-radius:14px;justify-content:center;align-items:center;gap:4px;padding:0 10px;font-size:12px;line-height:18px;display:inline-flex}.VqXecW_nativePrimary{color:var(--dsw-alias-label-primary-foreground,var(--dsw-alias-label-primary-inverted,#fff));background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary));border:0}.VqXecW_nativePrimary:hover{background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-brand-primary))}.VqXecW_nativeOutline{color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);background:0 0}.VqXecW_nativeOutline:hover{background:var(--dsw-alias-interactive-bg-hover)}.VqXecW_iconOnlyButton{width:28px;padding:0}.VqXecW_compactActionIcon svg{width:14px;height:14px}.VqXecW_operation,.VqXecW_error{border-radius:10px;order:3;align-items:center;gap:7px;padding:9px 12px;font-size:12px;line-height:18px;display:flex}.VqXecW_operation{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-interactive-bg-hover)}.VqXecW_operation svg{animation:1s linear infinite VqXecW_spin}.VqXecW_error{color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-state-error-tertiary)}.VqXecW_aboutGrid{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;order:6;grid-template-columns:minmax(0,1fr) minmax(260px,1fr);display:grid}.VqXecW_aboutGrid>*{padding:16px 18px}.VqXecW_aboutGrid>aside{border-left:1px solid var(--dsw-alias-border-l2)}.VqXecW_aboutGrid h3,.VqXecW_recommendations h3{margin-bottom:10px;font-size:14px;font-weight:600;line-height:22px}.VqXecW_aboutGrid article>p{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:21px}.VqXecW_tags{flex-wrap:wrap;gap:6px;margin-top:12px;display:flex}.VqXecW_aboutGrid dl{margin:12px 0 0}.VqXecW_aboutGrid dl div{border-bottom:1px solid var(--dsw-alias-border-l3);justify-content:space-between;gap:12px;padding:7px 0;font-size:12px;line-height:18px;display:flex}.VqXecW_aboutGrid dt{color:var(--dsw-alias-label-caption)}.VqXecW_aboutGrid dd{text-align:right;color:var(--dsw-alias-label-secondary);margin:0}.VqXecW_notice{color:var(--dsw-alias-state-warning-primary);font-size:11px;line-height:17px;margin-top:10px!important}.VqXecW_changelog ol{gap:8px;margin:0 0 12px;padding:0;list-style:none;display:grid}.VqXecW_changelog li{color:var(--dsw-alias-label-secondary);grid-template-columns:64px minmax(0,1fr);gap:10px;font-size:12px;line-height:18px;display:grid}.VqXecW_changelog strong{color:var(--dsw-alias-label-caption);font-weight:500}.VqXecW_changelog a{color:var(--dsw-alias-label-primary);font-size:12px;text-decoration:none}.VqXecW_changelog a:hover{text-decoration:underline}.VqXecW_recommendations{border-top:1px solid var(--dsw-alias-border-l2);order:7;padding-top:18px}.VqXecW_recommendations>div{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;display:grid}.VqXecW_recommendations button{cursor:pointer;text-align:left;width:100%;min-width:0;height:auto;min-height:0;color:inherit;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);font:inherit;border-radius:10px;flex-direction:column;align-self:start;padding:0;display:flex;overflow:hidden}.VqXecW_recommendations button:hover{border-color:var(--dsw-alias-border-l1);background:var(--dsw-alias-interactive-bg-hover)}.VqXecW_recommendations img{aspect-ratio:16/9;object-fit:contain;background:var(--dsw-alias-bg-layer-2);width:100%;display:block}.VqXecW_recommendations button>span{box-sizing:border-box;justify-content:space-between;align-items:flex-start;gap:10px;width:100%;padding:11px 12px 12px;display:flex}.VqXecW_recommendations strong{white-space:normal;overflow-wrap:anywhere;min-width:0;font-size:13px;line-height:19px}.VqXecW_recommendations small{color:var(--dsw-alias-label-caption);flex:none;align-items:center;gap:3px;padding-top:1px;font-size:11px;line-height:18px;display:inline-flex}.VqXecW_loading,.VqXecW_listLoading,.VqXecW_empty{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}.VqXecW_loading{align-items:center;gap:7px;margin:auto;display:flex}.VqXecW_listLoading{justify-content:center;align-items:center;gap:7px;padding:24px 8px;display:flex}.VqXecW_loading svg,.VqXecW_listLoading svg{animation:1s linear infinite VqXecW_spin}.VqXecW_empty{text-align:center;padding:24px 8px}.VqXecW_submission{gap:10px;width:100%;min-width:0;max-width:100%;display:grid}.VqXecW_submission small{color:var(--dsw-alias-label-caption);margin:0;font-size:12px;line-height:18px}.VqXecW_submission textarea{box-sizing:border-box;resize:vertical;width:100%;min-width:0;max-width:100%;min-height:300px;color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:10px;outline:none;padding:12px;font:12px/1.6 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}.VqXecW_submission textarea:focus{border-color:var(--dsw-alias-brand-primary)}@keyframes VqXecW_spin{to{transform:rotate(360deg)}}@keyframes VqXecW_skeletonShimmer{to{background-position:-200% 0}}@media (prefers-reduced-motion:reduce){.VqXecW_skeletonCard span:first-child,.VqXecW_skeletonCard i,.VqXecW_detailSkeleton span,.VqXecW_detailSkeleton i,.VqXecW_loadMoreHint span{animation:none}.VqXecW_skinCard>img{transition:none}}@media (width<=959px){.VqXecW_root{height:100%;min-height:0;max-height:100%;display:block;overflow:hidden}.VqXecW_catalog{border-right:0;height:100%;min-height:0;overflow:hidden}.VqXecW_detail{overscroll-behavior:contain;-webkit-overflow-scrolling:touch;height:100%;min-height:0;display:none;overflow-y:auto}.VqXecW_root[data-detail=open] .VqXecW_catalog{display:none}.VqXecW_root[data-detail=open] .VqXecW_detail{display:flex}.VqXecW_mobileBack.VqXecW_nativeOutline{display:inline-flex}.VqXecW_detailHeader{grid-template-columns:76px minmax(0,1fr);align-items:start;gap:14px;display:grid}.VqXecW_skinAvatar{width:76px;height:76px}.VqXecW_titleBlock{padding-top:0}.VqXecW_titleBlock h2{font-size:20px;line-height:27px}.VqXecW_titleBlock .VqXecW_description{margin-top:7px}.VqXecW_titleBlock .VqXecW_version{flex-wrap:wrap;row-gap:2px;margin-top:6px}.VqXecW_actionRow{justify-content:flex-start}.VqXecW_aboutGrid{grid-template-columns:1fr}.VqXecW_aboutGrid>aside{border-top:1px solid var(--dsw-alias-border-l2);border-left:0}.VqXecW_recommendations>div{grid-template-columns:1fr}}@media (prefers-reduced-motion:reduce){.VqXecW_operation svg,.VqXecW_loading svg,.VqXecW_listLoading svg{animation:none}}";
		const tagId = "dsh-skin-market/SkinMarket.module.css";
		if (typeof document !== "undefined" && !document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]")) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-skin-market";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var SkinMarket_module_css_default = {
			"iconOnlyButton": "VqXecW_iconOnlyButton",
			"filterBar": "VqXecW_filterBar",
			"cardTitle": "VqXecW_cardTitle",
			"mobileBack": "VqXecW_mobileBack",
			"actionDivider": "VqXecW_actionDivider",
			"root": "VqXecW_root",
			"tags": "VqXecW_tags",
			"nativeOutline": "VqXecW_nativeOutline",
			"operation": "VqXecW_operation",
			"aboutGrid": "VqXecW_aboutGrid",
			"cardStatusUpdate": "VqXecW_cardStatusUpdate",
			"listSkeleton": "VqXecW_listSkeleton",
			"skeletonShimmer": "VqXecW_skeletonShimmer",
			"catalogTitle": "VqXecW_catalogTitle",
			"skinCard": "VqXecW_skinCard",
			"externalPlugin": "VqXecW_externalPlugin",
			"skinList": "VqXecW_skinList",
			"detail": "VqXecW_detail",
			"author": "VqXecW_author",
			"description": "VqXecW_description",
			"loadMoreHint": "VqXecW_loadMoreHint",
			"detailSkeleton": "VqXecW_detailSkeleton",
			"cardMeta": "VqXecW_cardMeta",
			"cardStatus": "VqXecW_cardStatus",
			"detailHeader": "VqXecW_detailHeader",
			"settingsNavIcon": "VqXecW_settingsNavIcon",
			"version": "VqXecW_version",
			"srOnly": "VqXecW_srOnly",
			"repoMeta": "VqXecW_repoMeta",
			"spin": "VqXecW_spin",
			"filterPill": "VqXecW_filterPill",
			"error": "VqXecW_error",
			"listLoading": "VqXecW_listLoading",
			"hero": "VqXecW_hero",
			"compactActionIcon": "VqXecW_compactActionIcon",
			"empty": "VqXecW_empty",
			"sortButton": "VqXecW_sortButton",
			"changelog": "VqXecW_changelog",
			"actionRow": "VqXecW_actionRow",
			"submission": "VqXecW_submission",
			"notice": "VqXecW_notice",
			"catalogHeader": "VqXecW_catalogHeader",
			"titleBlock": "VqXecW_titleBlock",
			"thumbnails": "VqXecW_thumbnails",
			"skinAvatar": "VqXecW_skinAvatar",
			"cardStars": "VqXecW_cardStars",
			"statusActive": "VqXecW_statusActive",
			"status": "VqXecW_status",
			"filters": "VqXecW_filters",
			"nativePrimary": "VqXecW_nativePrimary",
			"loading": "VqXecW_loading",
			"skinCardBody": "VqXecW_skinCardBody",
			"cardMetaLine": "VqXecW_cardMetaLine",
			"recommendations": "VqXecW_recommendations",
			"repoLink": "VqXecW_repoLink",
			"stars": "VqXecW_stars",
			"skeletonCard": "VqXecW_skeletonCard",
			"catalog": "VqXecW_catalog",
			"staticPill": "VqXecW_staticPill"
		};
		//#endregion
		//#region src/client/catalog-cache.ts
		const DATABASE = "dsh-skin-market";
		const STORE = "catalog";
		const KEY = "latest-v1";
		function openCatalogDatabase() {
			return new Promise((resolve, reject) => {
				if (typeof indexedDB === "undefined") return reject(/* @__PURE__ */ new Error("IndexedDB is unavailable"));
				const request = indexedDB.open(DATABASE, 1);
				request.onupgradeneeded = () => {
					if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
				};
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error ?? /* @__PURE__ */ new Error("Failed to open catalog cache"));
			});
		}
		function looksLikeCatalog(value) {
			return Array.isArray(value) && value.every((item) => typeof item === "object" && item !== null && typeof item.id === "string");
		}
		const browserCatalogCache = {
			async read() {
				let database = null;
				try {
					database = await openCatalogDatabase();
					return await new Promise((resolve, reject) => {
						const request = database.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
						request.onsuccess = () => resolve(looksLikeCatalog(request.result) ? request.result : null);
						request.onerror = () => reject(request.error ?? /* @__PURE__ */ new Error("Failed to read catalog cache"));
					});
				} catch {
					return null;
				} finally {
					database?.close();
				}
			},
			async write(skins) {
				let database = null;
				try {
					database = await openCatalogDatabase();
					await new Promise((resolve, reject) => {
						const transaction = database.transaction(STORE, "readwrite");
						transaction.objectStore(STORE).put(skins, KEY);
						transaction.oncomplete = () => resolve();
						transaction.onerror = () => reject(transaction.error ?? /* @__PURE__ */ new Error("Failed to write catalog cache"));
						transaction.onabort = () => reject(transaction.error ?? /* @__PURE__ */ new Error("Catalog cache write aborted"));
					});
				} catch {} finally {
					database?.close();
				}
			}
		};
		//#endregion
		//#region src/client/submission.ts
		const REGISTRY_REPOSITORY = "https://github.com/kingOfSoySauce/dsh-skin-market";
		const REGISTRY_PATH = "registry/skins";
		function normalizeGitHubRepository(value) {
			try {
				const url = new URL(value.trim());
				if (url.protocol !== "https:" || url.hostname !== "github.com") return null;
				const parts = url.pathname.replace(/\.git$/, "").split("/").filter(Boolean);
				if (parts.length !== 2) return null;
				return `https://github.com/${parts[0]}/${parts[1]}`;
			} catch {
				return null;
			}
		}
		function createSubmissionPrompt(repositoryInput) {
			const repository = repositoryInput === void 0 ? null : normalizeGitHubRepository(repositoryInput);
			if (repositoryInput !== void 0 && repository === null) return "";
			return `请把我的 DSH 皮肤提交到 DSH Skin Market。

${repository === null ? "皮肤仓库：如果当前工作区就是待提交的皮肤仓库，请确认它的公开 GitHub remote；否则先向我索要公开 GitHub 仓库地址。" : `皮肤仓库：${repository}`}
目标目录仓库：${REGISTRY_REPOSITORY}
目录路径：${REGISTRY_PATH}

请自主完成以下工作：
1. 只用只读方式检查皮肤仓库；识别单包或 monorepo 子包，读取 package.json、DSH bundle/client 声明、cordis.patch.yml、README、许可证、预览图和 release/tag。
2. 确认它确实是可安装的 DSH Web 皮肤。不要仅凭仓库名、README 文案或 dsh-plugin topic 判定。
3. 解析准备收录版本对应的完整 40 位 commit SHA。安装目标必须固定到该 SHA；禁止使用 main、master、HEAD 或其他可变分支。
4. 不要猜测皮肤名、包名、rowId、许可证、兼容版本或素材授权。缺少关键信息时先列出缺项，不要创建虚假条目。
5. 预览图只选仓库内真实截图，使用固定 commit 的 GitHub raw HTTPS 地址；不要使用 SVG、data URI、任意第三方图床或带追踪参数的 URL。
6. fork/clone 目标目录仓库，新建分支；按照 registry/skin.schema.json，在 ${REGISTRY_PATH} 下新增一个独立 YAML。不要修改无关文件，也不要覆盖已有条目。
7. 在目标目录仓库根目录运行 npm run registry 和相关测试。不得安装到我的真实 DSH profile，不得读取 .env、凭据、聊天记录或工作区外的私密文件。
8. 检查 git diff，提交变更并向 ${REGISTRY_REPOSITORY} 创建 PR。PR 标题使用“feat(registry): add <皮肤名>”，正文列出仓库、子包、版本、commit、许可证、预览来源、兼容性、自动检查结果和仍需人工确认的风险。
9. 创建 PR 后返回 PR 链接；如果没有 GitHub 权限或需要登录，只准备好分支、commit 和可复制的 PR 内容，明确告诉我下一步。

收录不等于安全认证。不要声称该皮肤已被 DSH 官方、安全团队或市场背书。`;
		}
		function createSkinInstallPrompt(skin) {
			const buildApproval = skin.install.allowBuild === void 0 ? "" : `\n- 这个固定版本包含 prepare 构建脚本。只允许精确构件键 \`${skin.install.allowBuild}\`：在 profile 的 pnpm-workspace.yaml 里合并 \`allowBuilds:\n    '${skin.install.allowBuild}': true\`，不得开启 dangerouslyAllowAllBuilds。`;
			return `请帮我把下面这个已固定版本的 DSH Web 皮肤安装到 web profile，并完成验证。\n\n- 仓库：${skin.repo}\n- 安装目标：${skin.install.target}\n- package：${skin.package}\n- loader rowId：${skin.rowId ?? skin.package}\n- 版本：${skin.install.version}\n- commit：${skin.install.commit}${buildApproval}\n\n要求：\n1. 不要改成 main、HEAD 或最新版本，必须使用上面的完整 commit。\n2. 运行 DSH 的 profile 插件安装命令；如果是只有 dsh.client 的皮肤，幂等地把上面的 package 和 rowId 注册到 web profile 的 cordis.patch.yml。\n3. 不要读取 .env、凭据或聊天记录；不要放宽其他包的构建权限。\n4. 安装后确认 profile package.json 中存在该依赖、node_modules 中的 package.json 声明了 dsh.client，并确认 loader 注册项存在。\n5. 告诉我是否需要重启 DSH Web；不要替我安装其他皮肤。`;
		}
		//#endregion
		//#region src/client/SkinMarketSection.tsx
		function captureListScroll(list) {
			if (list === null) return null;
			const listTop = list.getBoundingClientRect().top;
			const card = [...list.querySelectorAll("[data-skin-id]")].find((item) => item.getBoundingClientRect().bottom > listTop);
			return {
				skinId: card?.dataset.skinId ?? null,
				offset: card === void 0 ? 0 : card.getBoundingClientRect().top - listTop,
				scrollTop: list.scrollTop
			};
		}
		function restoreListScroll(list, anchor) {
			if (list === null || anchor === null) return;
			const card = anchor.skinId === null ? void 0 : [...list.querySelectorAll("[data-skin-id]")].find((item) => item.dataset.skinId === anchor.skinId);
			if (card === void 0) list.scrollTop = anchor.scrollTop;
			else list.scrollTop += card.getBoundingClientRect().top - list.getBoundingClientRect().top - anchor.offset;
		}
		const phases = {
			queued: "正在排队…",
			resolving: "正在解析版本…",
			downloading: "正在安装…",
			validating: "正在验证…",
			activating: "正在切换…",
			done: "完成",
			failed: "操作失败"
		};
		const mutationLabels = {
			install: "安装中",
			activate: "使用中",
			deactivate: "停用中",
			update: "更新中",
			uninstall: "卸载中"
		};
		const RELOAD_PARAM = "dsh-skin-reload";
		const ACTIVATION_WARNING_KEY = "dsh-skin-market:activation-warning-accepted";
		function restartReloadUrl(href, instanceId) {
			const url = new URL(href);
			url.searchParams.set(RELOAD_PARAM, instanceId);
			return url.toString();
		}
		function restoreMarketStyleOrder(root = document, marker = SkinMarket_module_css_default.filterPill) {
			for (const style of root.querySelectorAll("style")) if (style.dataset.plugin === "dsh-skin-market" || style.textContent?.includes(`.${marker}`) === true) style.parentNode?.appendChild(style);
		}
		async function json(url, init) {
			const response = await fetch(url, init);
			let body;
			try {
				body = await response.json();
			} catch {
				throw new Error(response.ok ? "皮肤市场服务未返回有效数据，请确认 Host 插件已经更新" : `皮肤市场请求失败（HTTP ${response.status}）`);
			}
			if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
			return body;
		}
		function runtimeFor(states, id) {
			return states.find((item) => item.skinId === id) ?? {
				skinId: id,
				installation: "missing",
				activation: "inactive",
				installedVersion: null,
				updateAvailable: false
			};
		}
		function statusLabel(state) {
			if (state.installation === "broken") return "安装异常";
			if (state.activation === "active") return "正在使用";
			if (state.activation === "restart-required") return "需要重启";
			if (state.installation === "installed") return "已安装";
			return "未安装";
		}
		function displayDate(value) {
			const date = new Date(value);
			return Number.isNaN(date.getTime()) ? "未知" : new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(date);
		}
		function SkinMarketSection({ t, clientRuntime, catalogCache = browserCatalogCache }) {
			const [skins, setSkins] = (0, react.useState)([]);
			const [states, setStates] = (0, react.useState)([]);
			const [installedClientPlugins, setInstalledClientPlugins] = (0, react.useState)([]);
			const [loading, setLoading] = (0, react.useState)(true);
			const [catalogLoading, setCatalogLoading] = (0, react.useState)(true);
			const [selectedId, setSelectedId] = (0, react.useState)("");
			const [query, setQuery] = (0, react.useState)("");
			const [filter, setFilter] = (0, react.useState)("all");
			const [sortBy, setSortBy] = (0, react.useState)("stars");
			const [visibleCount, setVisibleCount] = (0, react.useState)(20);
			const [shotIndex, setShotIndex] = (0, react.useState)(0);
			const [busy, setBusy] = (0, react.useState)(null);
			const [mutation, setMutation] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [confirmUninstall, setConfirmUninstall] = (0, react.useState)(false);
			const [activationWarningAccepted, setActivationWarningAccepted] = (0, react.useState)(() => {
				try {
					return window.localStorage.getItem(ACTIVATION_WARNING_KEY) === "true";
				} catch {
					return false;
				}
			});
			const [confirmRestart, setConfirmRestart] = (0, react.useState)(false);
			const [restarting, setRestarting] = (0, react.useState)(false);
			const [runningAgents, setRunningAgents] = (0, react.useState)(null);
			const [restartCheckFinished, setRestartCheckFinished] = (0, react.useState)(false);
			const [showDetail, setShowDetail] = (0, react.useState)(false);
			const [showSubmission, setShowSubmission] = (0, react.useState)(false);
			const [submissionCopied, setSubmissionCopied] = (0, react.useState)(false);
			const [installPromptCopied, setInstallPromptCopied] = (0, react.useState)(null);
			const [settingsNavIconHost, setSettingsNavIconHost] = (0, react.useState)(null);
			const skinListRef = (0, react.useRef)(null);
			const pendingScrollAnchor = (0, react.useRef)(null);
			const skinsRef = (0, react.useRef)([]);
			const selectedIdRef = (0, react.useRef)("");
			const userSelectedRef = (0, react.useRef)(false);
			const acceptCatalog = (0, react.useCallback)((incoming, runtimeStates = []) => {
				pendingScrollAnchor.current = captureListScroll(skinListRef.current);
				const nextSkins = [...incoming];
				const selectedBeforeRefresh = selectedIdRef.current;
				if (selectedBeforeRefresh !== "" && !nextSkins.some((skin) => skin.id === selectedBeforeRefresh)) {
					const selectedSkin = skinsRef.current.find((skin) => skin.id === selectedBeforeRefresh);
					if (selectedSkin !== void 0) nextSkins.push(selectedSkin);
				}
				skinsRef.current = nextSkins;
				setSkins(nextSkins);
				setSelectedId((value) => {
					const active = runtimeStates.find((item) => item.activation === "active");
					const activeId = active !== void 0 && nextSkins.some((skin) => skin.id === active.skinId) ? active.skinId : null;
					const next = !userSelectedRef.current && activeId !== null ? activeId : value !== "" && nextSkins.some((skin) => skin.id === value) ? value : nextSkins[0]?.id ?? "";
					selectedIdRef.current = next;
					return next;
				});
			}, []);
			const refresh = (0, react.useCallback)(async (showLoading = false) => {
				if (showLoading) {
					setLoading(true);
					if (skinsRef.current.length === 0) setCatalogLoading(true);
				}
				try {
					const catalogRequest = json("/dsh-skin-market/catalog").then((catalog) => {
						if (showLoading) setCatalogLoading(false);
						return catalog;
					});
					const stateRequest = json("/dsh-skin-market/state").then((state) => {
						if (showLoading) setLoading(false);
						return state;
					});
					const [catalog, state] = await Promise.all([catalogRequest, stateRequest]);
					acceptCatalog(catalog.skins, state.skins);
					catalogCache.write(catalog.skins).catch(() => void 0);
					setStates(state.skins);
					setInstalledClientPlugins(state.installedClientPlugins ?? []);
					setRunningAgents(typeof state.runningAgentCount === "number" && Number.isInteger(state.runningAgentCount) ? state.runningAgentCount : null);
				} finally {
					if (showLoading) {
						setLoading(false);
						setCatalogLoading(false);
					}
				}
			}, [acceptCatalog, catalogCache]);
			const openRestartConfirm = (0, react.useCallback)(async () => {
				setError(null);
				setRunningAgents(null);
				setRestartCheckFinished(false);
				setConfirmRestart(true);
				try {
					const state = await json("/dsh-skin-market/state", { cache: "no-store" });
					setRunningAgents(typeof state.runningAgentCount === "number" && Number.isInteger(state.runningAgentCount) ? state.runningAgentCount : null);
					setRestartCheckFinished(true);
				} catch (reason) {
					setRestartCheckFinished(true);
					setError(reason instanceof Error ? reason.message : String(reason));
				}
			}, []);
			(0, react.useEffect)(() => {
				let disposed = false;
				(async () => {
					const cached = await catalogCache.read();
					if (disposed) return;
					if (cached !== null && cached.length > 0) {
						acceptCatalog(cached);
						setCatalogLoading(false);
					}
					await refresh(true).catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
				})();
				return () => {
					disposed = true;
				};
			}, [
				acceptCatalog,
				catalogCache,
				refresh
			]);
			(0, react.useEffect)(() => {
				const timer = window.setInterval(() => {
					refresh(false).catch(() => void 0);
				}, 3e5);
				const refreshOnFocus = () => {
					refresh(false).catch(() => void 0);
				};
				window.addEventListener("focus", refreshOnFocus);
				return () => {
					window.clearInterval(timer);
					window.removeEventListener("focus", refreshOnFocus);
				};
			}, [refresh]);
			(0, react.useLayoutEffect)(() => {
				restoreListScroll(skinListRef.current, pendingScrollAnchor.current);
				pendingScrollAnchor.current = null;
			}, [skins]);
			(0, react.useEffect)(() => {
				const url = new URL(window.location.href);
				if (!url.searchParams.has(RELOAD_PARAM)) return;
				url.searchParams.delete(RELOAD_PARAM);
				window.history.replaceState(window.history.state, "", url);
			}, []);
			(0, react.useEffect)(() => {
				const style = document.createElement("style");
				style.dataset.dshSkinMarketWide = "true";
				style.textContent = "@media (min-width: 960px){[role=\"dialog\"]:has([data-dsh-skin-market]){width:min(1280px,calc(100vw - 48px));height:min(860px,calc(100vh - 48px))}}";
				document.head.appendChild(style);
				return () => style.remove();
			}, []);
			(0, react.useEffect)(() => {
				const currentNav = document.querySelector("[data-dsh-skin-market]")?.closest("[role=\"dialog\"]")?.querySelector("nav button[aria-current=\"true\"]");
				const defaultIcon = currentNav?.querySelector("svg");
				if (!(currentNav instanceof HTMLElement) || !(defaultIcon instanceof SVGElement)) return;
				const host = document.createElement("span");
				host.className = SkinMarket_module_css_default.settingsNavIcon;
				host.setAttribute("aria-hidden", "true");
				defaultIcon.dataset.dshSkinMarketDefaultIcon = "hidden";
				defaultIcon.insertAdjacentElement("beforebegin", host);
				setSettingsNavIconHost(host);
				return () => {
					defaultIcon.removeAttribute("data-dsh-skin-market-default-icon");
					host.remove();
				};
			}, []);
			const selected = skins.find((skin) => skin.id === selectedId) ?? skins[0];
			const state = selected === void 0 ? null : runtimeFor(states, selected.id);
			const compatibilityUnverified = selected?.review?.compatibility === "unverified";
			const manualOnly = selected?.review?.installation === "manual-only";
			const autoInstallable = !compatibilityUnverified && !manualOnly;
			const filtered = (0, react.useMemo)(() => skins.filter((skin) => {
				if (!`${skin.name.zh} ${skin.name.en} ${skin.author} ${skin.tags.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase())) return false;
				if (filter === "installed") return runtimeFor(states, skin.id).installation !== "missing";
				return true;
			}).sort((a, b) => sortBy === "latest" ? Date.parse(b.releaseUpdatedAt) - Date.parse(a.releaseUpdatedAt) : b.githubStars - a.githubStars), [
				skins,
				states,
				filter,
				query,
				sortBy
			]);
			const visibleSkins = (0, react.useMemo)(() => {
				const visible = filtered.slice(0, visibleCount);
				const selectedSkin = filtered.find((skin) => skin.id === selectedId);
				if (selectedSkin !== void 0 && !visible.some((skin) => skin.id === selectedSkin.id)) visible.push(selectedSkin);
				return visible;
			}, [
				filtered,
				selectedId,
				visibleCount
			]);
			(0, react.useEffect)(() => {
				setVisibleCount(20);
			}, [
				filter,
				query,
				sortBy
			]);
			const run = (0, react.useCallback)(async (kind) => {
				if (selected === void 0) return false;
				setError(null);
				setMutation({
					skinId: selected.id,
					kind
				});
				try {
					const result = await json(`/dsh-skin-market/${kind}`, {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ skinId: selected.id })
					});
					for (;;) {
						const operation = await json(`/dsh-skin-market/operations/${result.operationId}`);
						setBusy(operation);
						if (operation.phase === "done") {
							setBusy(null);
							let needsRestart = false;
							if (kind === "deactivate" || kind === "uninstall") await clientRuntime?.setActive(selected.package, false);
							else if (kind === "activate" && clientRuntime !== void 0) {
								needsRestart = !await switchClientSkin(clientRuntime, skins.map((skin) => skin.package), selected.package);
								restoreMarketStyleOrder();
							}
							await refresh();
							if (needsRestart) {
								setStates((value) => value.map((item) => item.skinId === selected.id ? {
									...item,
									activation: "restart-required"
								} : item));
								await openRestartConfirm();
							}
							return true;
						}
						if (operation.phase === "failed") throw new Error(operation.message ?? "操作失败");
						await new Promise((resolve) => setTimeout(resolve, 600));
					}
				} catch (reason) {
					setBusy(null);
					await refresh().catch(() => void 0);
					setError(reason instanceof Error ? reason.message : String(reason));
					return false;
				} finally {
					setMutation(null);
				}
			}, [
				clientRuntime,
				openRestartConfirm,
				refresh,
				selected,
				skins
			]);
			const activateSelected = (0, react.useCallback)(() => {
				try {
					window.localStorage.setItem(ACTIVATION_WARNING_KEY, "true");
				} catch {}
				setActivationWarningAccepted(true);
				run("activate");
			}, [run]);
			const installAndActivate = (0, react.useCallback)(async () => {
				if (await run("install")) activateSelected();
			}, [activateSelected, run]);
			const restartNow = (0, react.useCallback)(async () => {
				if (selected === void 0) return;
				setRestarting(true);
				setError(null);
				try {
					const accepted = await json("/dsh-skin-market/restart", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ skinId: selected.id })
					});
					const deadline = Date.now() + 9e4;
					while (Date.now() < deadline) {
						await new Promise((resolve) => setTimeout(resolve, 500));
						try {
							const next = await json("/dsh-skin-market/state", { cache: "no-store" });
							if (next.instanceId !== accepted.instanceId) {
								window.location.replace(restartReloadUrl(window.location.href, next.instanceId));
								return;
							}
						} catch {}
					}
					throw new Error("DeepSeek Harness 重启超时，请手动刷新页面");
				} catch (reason) {
					setConfirmRestart(false);
					setError(reason instanceof Error ? reason.message : String(reason));
				} finally {
					setRestarting(false);
				}
			}, [selected]);
			const select = (id) => {
				userSelectedRef.current = true;
				selectedIdRef.current = id;
				setSelectedId(id);
				setShotIndex(0);
				setShowDetail(true);
				setError(null);
				setInstallPromptCopied(null);
			};
			const recommendations = selected?.recommendations.map((id) => skins.find((skin) => skin.id === id)).filter((skin) => skin !== void 0) ?? [];
			const submissionPrompt = createSubmissionPrompt();
			const copySubmissionPrompt = async () => {
				await navigator.clipboard.writeText(submissionPrompt);
				setSubmissionCopied(true);
			};
			const copyInstallPrompt = async () => {
				if (selected === void 0) return;
				await navigator.clipboard.writeText(createSkinInstallPrompt(selected));
				setInstallPromptCopied(selected.id);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: SkinMarket_module_css_default.root,
				"data-dsh-skin-market": true,
				"data-detail": showDetail ? "open" : "closed",
				children: [
					settingsNavIconHost !== null && (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(r, {
						size: 16,
						weight: "regular",
						"aria-hidden": "true"
					}), settingsNavIconHost),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
						className: SkinMarket_module_css_default.catalog,
						"aria-label": t("catalog"),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: SkinMarket_module_css_default.catalogHeader,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: SkinMarket_module_css_default.catalogTitle,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: t("title") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										className: SkinMarket_module_css_default.nativeOutline,
										variant: "outline",
										size: "sm",
										onClick: () => {
											setShowSubmission(true);
											setSubmissionCopied(false);
										},
										children: "提交皮肤"
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
									value: query,
									onChange: (event) => setQuery(event.currentTarget.value),
									icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutline16, {}),
									placeholder: t("search"),
									"aria-label": t("search")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: SkinMarket_module_css_default.filterBar,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: SkinMarket_module_css_default.filters,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, {
											className: SkinMarket_module_css_default.filterPill,
											"data-active": filter === "all" ? "true" : void 0,
											"aria-pressed": filter === "all",
											onClick: () => setFilter("all"),
											children: "全部"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, {
											className: SkinMarket_module_css_default.filterPill,
											"data-active": filter === "installed" ? "true" : void 0,
											"aria-pressed": filter === "installed",
											onClick: () => setFilter("installed"),
											children: "已安装"
										})]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										className: SkinMarket_module_css_default.sortButton,
										variant: "ghost",
										size: "sm",
										onClick: () => setSortBy((value) => value === "stars" ? "latest" : "stars"),
										children: [
											sortBy === "stars" ? "Stars" : "最新",
											" ",
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, {})
										]
									})]
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: SkinMarket_module_css_default.skinList,
							ref: skinListRef,
							onScroll: (event) => {
								const list = event.currentTarget;
								if (filtered.length > visibleCount && list.scrollHeight - list.scrollTop - list.clientHeight < 320) setVisibleCount((value) => Math.min(filtered.length, value + 20));
							},
							children: [
								catalogLoading && skins.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: SkinMarket_module_css_default.listSkeleton,
									role: "status",
									"aria-label": "正在加载皮肤列表",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: SkinMarket_module_css_default.srOnly,
										children: "正在加载皮肤列表…"
									}), Array.from({ length: 8 }, (_, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: SkinMarket_module_css_default.skeletonCard,
										"aria-hidden": "true",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {})] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {})
										]
									}, index))]
								}) : visibleSkins.map((skin) => {
									const itemState = runtimeFor(states, skin.id);
									const mutationLabel = mutation?.skinId === skin.id ? mutationLabels[mutation.kind] : null;
									return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "ghost",
										className: SkinMarket_module_css_default.skinCard,
										"data-skin-id": skin.id,
										"data-selected": skin.id === selected?.id,
										"aria-current": skin.id === selected?.id ? "true" : void 0,
										onClick: () => select(skin.id),
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
												src: skin.screenshots[0],
												alt: `${skin.name.zh} 界面预览`,
												loading: "lazy",
												decoding: "async",
												onLoad: (event) => {
													event.currentTarget.dataset.loaded = "true";
												},
												onError: (event) => {
													event.currentTarget.dataset.failed = "true";
												}
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: SkinMarket_module_css_default.skinCardBody,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: SkinMarket_module_css_default.cardTitle,
													children: skin.name.zh
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
													className: SkinMarket_module_css_default.cardMetaLine,
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: SkinMarket_module_css_default.cardMeta,
														children: skin.author
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
														className: SkinMarket_module_css_default.cardStars,
														title: `GitHub Stars 快照，更新于 ${displayDate(skin.starsUpdatedAt)}`,
														children: [
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StarIcon, {
																size: 12,
																"aria-hidden": "true"
															}),
															" ",
															skin.githubStars
														]
													})]
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, {
												className: mutationLabel !== null || itemState.updateAvailable ? `${SkinMarket_module_css_default.cardStatus} ${SkinMarket_module_css_default.cardStatusUpdate}` : SkinMarket_module_css_default.cardStatus,
												children: mutationLabel ?? (itemState.updateAvailable ? "可更新" : itemState.installation === "missing" && skin.review?.installation === "manual-only" ? "手动安装" : itemState.installation === "missing" && skin.review?.compatibility === "unverified" ? "待验证" : statusLabel(itemState))
											})
										]
									}, skin.id);
								}),
								!catalogLoading && visibleCount < filtered.length && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: SkinMarket_module_css_default.loadMoreHint,
									"aria-hidden": "true",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {})]
								}),
								!catalogLoading && filtered.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: SkinMarket_module_css_default.empty,
									children: "没有匹配的皮肤"
								}),
								!loading && filter === "installed" && installedClientPlugins.map((plugin) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: `${SkinMarket_module_css_default.skinCard} ${SkinMarket_module_css_default.externalPlugin}`,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: SkinMarket_module_css_default.skinCardBody,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: SkinMarket_module_css_default.cardTitle,
											children: plugin.package
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: SkinMarket_module_css_default.cardMetaLine,
											children: [
												"市场外客户端插件 · ",
												plugin.version ?? "版本未知",
												" · ",
												plugin.registered ? `已注册 ${plugin.rowIds.join(", ")}` : "尚未发现 loader 注册项"
											]
										})]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, {
										className: SkinMarket_module_css_default.cardStatus,
										children: "市场外"
									})]
								}, plugin.package)),
								!loading && selected === void 0 && error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: SkinMarket_module_css_default.error,
									role: "alert",
									children: error
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("main", {
						className: SkinMarket_module_css_default.detail,
						children: loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: SkinMarket_module_css_default.detailSkeleton,
							role: "status",
							"aria-label": "正在加载皮肤详情",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: SkinMarket_module_css_default.srOnly,
									children: "正在加载皮肤详情…"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {})] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {})
							]
						}) : selected !== void 0 && state !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								className: `${SkinMarket_module_css_default.mobileBack} ${SkinMarket_module_css_default.nativeOutline}`,
								variant: "outline",
								size: "sm",
								icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronLeftOutline14, {}),
								onClick: () => setShowDetail(false),
								children: "返回列表"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
								className: SkinMarket_module_css_default.detailHeader,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
									className: SkinMarket_module_css_default.skinAvatar,
									src: selected.screenshots[0],
									alt: ""
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: SkinMarket_module_css_default.titleBlock,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: selected.name.zh }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: SkinMarket_module_css_default.author,
											children: selected.author
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: SkinMarket_module_css_default.description,
											children: selected.description
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
											className: SkinMarket_module_css_default.version,
											children: [
												"版本 ",
												selected.install.version,
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													"aria-hidden": "true",
													children: " · "
												}),
												compatibilityUnverified ? "DSH 兼容性待验证" : `兼容 DSH ${selected.compatibility.dsh}`,
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, {
													className: state.activation === "active" ? `${SkinMarket_module_css_default.status} ${SkinMarket_module_css_default.statusActive}` : SkinMarket_module_css_default.status,
													children: compatibilityUnverified && state.installation === "missing" ? "待验证" : statusLabel(state)
												})
											]
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: SkinMarket_module_css_default.actionRow,
								children: [
									state.installation === "missing" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
										autoInstallable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											className: SkinMarket_module_css_default.nativePrimary,
											variant: "primary",
											size: "sm",
											icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDownloadOutline16, {}),
											disabled: busy !== null,
											onClick: () => void installAndActivate(),
											children: "安装并使用"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											className: autoInstallable ? SkinMarket_module_css_default.nativeOutline : SkinMarket_module_css_default.nativePrimary,
											variant: autoInstallable ? "outline" : "primary",
											size: "sm",
											icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCopyOutline16, {}),
											disabled: busy !== null,
											onClick: () => void copyInstallPrompt(),
											children: installPromptCopied === selected.id ? "安装提示词已复制" : "复制安装提示词"
										}),
										!autoInstallable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											className: SkinMarket_module_css_default.nativeOutline,
											variant: "outline",
											size: "sm",
											icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MarkGithubIcon, { size: 16 }),
											disabled: busy !== null,
											title: "前往 GitHub 查看维护者提供的手动安装方式",
											onClick: () => window.open(selected.repo, "_blank", "noopener,noreferrer"),
											children: compatibilityUnverified ? "待验证，手动安装" : "查看安装说明"
										})
									] }),
									state.installation === "installed" && state.activation === "inactive" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										className: SkinMarket_module_css_default.nativePrimary,
										variant: "primary",
										size: "sm",
										disabled: busy !== null,
										onClick: activateSelected,
										children: "使用"
									}),
									state.activation === "restart-required" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										className: SkinMarket_module_css_default.nativePrimary,
										variant: "primary",
										size: "sm",
										disabled: busy !== null,
										onClick: () => void openRestartConfirm(),
										children: "重启以应用"
									}),
									state.activation === "active" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										className: SkinMarket_module_css_default.nativeOutline,
										variant: "outline",
										size: "sm",
										disabled: busy !== null,
										onClick: () => void run("deactivate"),
										children: "停用"
									}),
									state.updateAvailable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										className: `${state.activation === "active" ? SkinMarket_module_css_default.nativePrimary : SkinMarket_module_css_default.nativeOutline} ${SkinMarket_module_css_default.compactActionIcon}`,
										variant: state.activation === "active" ? "primary" : "outline",
										size: "sm",
										icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutline16, {}),
										disabled: busy !== null,
										onClick: () => void run("update"),
										children: "更新"
									}),
									state.installation !== "missing" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										className: `${SkinMarket_module_css_default.nativeOutline} ${SkinMarket_module_css_default.iconOnlyButton} ${SkinMarket_module_css_default.compactActionIcon}`,
										variant: "outline",
										size: "sm",
										icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutline16, {}),
										"aria-label": "卸载",
										title: "卸载",
										disabled: busy !== null,
										onClick: () => setConfirmUninstall(true)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: SkinMarket_module_css_default.actionDivider,
										"aria-hidden": "true"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: SkinMarket_module_css_default.repoMeta,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: SkinMarket_module_css_default.stars,
											title: `GitHub Stars 快照，更新于 ${displayDate(selected.starsUpdatedAt)}`,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StarIcon, {
													size: 16,
													"aria-hidden": "true"
												}),
												" ",
												selected.githubStars
											]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("a", {
											className: SkinMarket_module_css_default.repoLink,
											href: selected.repo,
											target: "_blank",
											rel: "noreferrer",
											title: selected.repo,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MarkGithubIcon, {
												size: 16,
												"aria-hidden": "true"
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: selected.repo.replace("https://", "") })]
										})]
									})
								]
							}),
							state.installation === "installed" && state.activation === "inactive" && !activationWarningAccepted && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: SkinMarket_module_css_default.notice,
								role: "note",
								children: "首次启用提示：请先在设置 → 插件中停用其他皮肤、主题和外观插件，避免全局样式冲突。点击“使用”即表示已确认。"
							}),
							busy !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: SkinMarket_module_css_default.operation,
								role: "status",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconLoadingOutline16, { size: 16 }),
									" ",
									phases[busy.phase]
								]
							}),
							error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: SkinMarket_module_css_default.error,
								role: "alert",
								children: error
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: SkinMarket_module_css_default.hero,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
									src: selected.screenshots[shotIndex] ?? selected.screenshots[0],
									alt: `${selected.name.zh} 大图预览`
								})
							}),
							selected.screenshots.length > 1 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: SkinMarket_module_css_default.thumbnails,
								"aria-label": "截图选择",
								children: selected.screenshots.map((shot, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "ghost",
									"data-selected": index === shotIndex,
									onClick: () => setShotIndex(index),
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
										src: shot,
										alt: `${selected.name.zh} 截图 ${index + 1}`
									})
								}, shot))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: SkinMarket_module_css_default.aboutGrid,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: "关于此皮肤" }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: selected.description }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: SkinMarket_module_css_default.tags,
										children: selected.tags.map((tag) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, {
											className: SkinMarket_module_css_default.staticPill,
											children: tag
										}, tag))
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dl", {
										className: SkinMarket_module_css_default.metadata,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "许可证" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: selected.license.code })] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "代码商业使用" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: selected.license.commercialUse ? "许可证允许" : "未获授权" })] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: "模式" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: selected.modes.join(" / ") })] })
										]
									}),
									compatibilityUnverified && !manualOnly && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: SkinMarket_module_css_default.notice,
										children: "维护者尚未声明 DSH 兼容范围，市场暂不提供自动安装。可复制安装提示词交给 Agent 验证安装，或前往 GitHub 查看说明。"
									}),
									manualOnly && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: SkinMarket_module_css_default.notice,
										children: "该仓库缺少市场自动注册所需的信息；请前往 GitHub 按维护者说明手动安装。"
									}),
									selected.review?.preview === "repository-card" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: SkinMarket_module_css_default.notice,
										children: "该仓库没有可识别的皮肤截图，当前展示的是 GitHub 仓库卡片，并非界面预览。"
									}),
									selected.license.notice && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: SkinMarket_module_css_default.notice,
										children: selected.license.notice
									})
								] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
									className: SkinMarket_module_css_default.changelog,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: "收录信息" }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("ol", { children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: selected.install.version }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["版本快照更新于 ", displayDate(selected.releaseUpdatedAt)] })] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "Stars" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
												selected.githubStars,
												"，更新于 ",
												displayDate(selected.starsUpdatedAt)
											] })] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "兼容" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: compatibilityUnverified ? "等待维护者声明 DSH 兼容范围" : `支持 DSH ${selected.compatibility.dsh}` })] })
										] }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
											href: selected.repo,
											target: "_blank",
											rel: "noreferrer",
											children: "查看仓库详情"
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
								className: SkinMarket_module_css_default.recommendations,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: "更多推荐" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: recommendations.map((skin) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "ghost",
									onClick: () => select(skin.id),
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
										src: skin.screenshots[0],
										alt: ""
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: skin.name.zh }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StarIcon, {
											size: 12,
											"aria-hidden": "true"
										}),
										" ",
										skin.githubStars
									] })] })]
								}, skin.id)) })]
							})
						] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: SkinMarket_module_css_default.loading,
							children: "暂无可展示的皮肤详情"
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: confirmUninstall,
						onClose: () => setConfirmUninstall(false),
						title: "卸载皮肤",
						closeLabel: "关闭",
						description: state?.activation === "active" ? "当前皮肤会先停用并恢复 DSH 默认外观，然后删除安装包。" : "将从当前 DSH profile 删除这个皮肤安装包。",
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							className: SkinMarket_module_css_default.nativeOutline,
							variant: "outline",
							size: "sm",
							onClick: () => setConfirmUninstall(false),
							children: "取消"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							className: SkinMarket_module_css_default.nativePrimary,
							variant: "primary",
							size: "sm",
							onClick: () => {
								setConfirmUninstall(false);
								run("uninstall");
							},
							children: "确认卸载"
						})] })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: confirmRestart,
						onClose: () => {
							if (!restarting) setConfirmRestart(false);
						},
						title: "需要重启 DSH 应用此皮肤",
						closeLabel: "关闭",
						description: restarting ? "正在重新启动 DSH，请稍候…" : runningAgents === null && !restartCheckFinished ? "正在检查是否有 Agent 运行。状态确认前不能重启。" : runningAgents === null ? "当前 Host 尚未加载安全检查。请确认没有 Agent 正在运行、重要内容已保存；你可以继续完成这一次升级重启。新版本加载后会自动检测 Agent 状态。" : runningAgents > 0 ? `检测到 ${runningAgents} 个 Agent 正在运行，现在不能重启。请等待任务完全结束后再试，否则可能中断任务并导致会话历史无法加载。` : "Agent 状态检查已通过。但重启仍会关闭所有会话连接；即使回复已经停止显示，也请确认重要内容已保存，且没有即将开始的新任务。",
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							className: SkinMarket_module_css_default.nativeOutline,
							variant: "outline",
							size: "sm",
							disabled: restarting,
							onClick: () => setConfirmRestart(false),
							children: "稍后"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							className: SkinMarket_module_css_default.nativePrimary,
							variant: "primary",
							size: "sm",
							disabled: restarting || runningAgents === null && !restartCheckFinished || (runningAgents ?? 0) > 0,
							onClick: () => void restartNow(),
							children: restarting ? "正在重启…" : runningAgents === null && !restartCheckFinished ? "正在检查…" : runningAgents === null ? "我已确认无任务，仍然重启" : runningAgents > 0 ? "有任务运行中" : "确认无任务，立即重启"
						})] })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: showSubmission,
						onClose: () => setShowSubmission(false),
						title: "提交你的皮肤",
						closeLabel: "关闭",
						description: "复制下面的提示词交给你的 Agent，它会确认皮肤仓库、完成检查并准备市场 PR。",
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							className: SkinMarket_module_css_default.nativeOutline,
							variant: "outline",
							size: "sm",
							onClick: () => setShowSubmission(false),
							children: "关闭"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							className: SkinMarket_module_css_default.nativePrimary,
							variant: "primary",
							size: "sm",
							onClick: () => void copySubmissionPrompt(),
							children: submissionCopied ? "已复制" : "复制提示词"
						})] }),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: SkinMarket_module_css_default.submission,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								"aria-label": "Agent 投稿提示词",
								readOnly: true,
								value: submissionPrompt,
								rows: 16
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: "提示词不会授权 Agent 安装皮肤到你的 DSH，也不会把 Topic 收录等同于安全审核。" })]
						})
					})
				]
			});
		}
		//#endregion
		//#region src/client/index.ts
		const namespace = "dsh-skin-market";
		const dictionaries = {
			zh: {
				nav: "皮肤市场",
				title: "皮肤市场",
				subtitle: "发现并管理 DSH 外观",
				search: "搜索皮肤",
				catalog: "皮肤列表"
			},
			en: {
				nav: "Skin Market",
				title: "Skin Market",
				subtitle: "Discover and manage DSH skins",
				search: "Search skins",
				catalog: "Skin catalog"
			}
		};
		async function switchClientSkin(runtime, packageNames, target) {
			for (const packageName of packageNames) await runtime.setActive(packageName, false);
			return runtime.setActive(target, true);
		}
		function createClientSkinRuntime(loader) {
			return { async setActive(packageName, active) {
				const entry = [...loader.entries()].find((item) => item.options.name === packageName);
				if (entry === void 0) return false;
				await entry.update({ disabled: active ? null : true }, false, true);
				return true;
			} };
		}
		const name = "dsh-skin-market";
		const inject = [
			"slots",
			"locale",
			"loader"
		];
		const REQUIRED_PRIMITIVES = [
			"Button",
			"Input",
			"Modal",
			"Pill"
		];
		function missingPrimitives(module) {
			return REQUIRED_PRIMITIVES.filter((key) => module[key] === void 0);
		}
		function apply(ctx) {
			const missing = missingPrimitives(_deepseek_ai_dsh_client_ui_primitives);
			if (missing.length > 0) {
				console.warn(`[dsh-skin-market] missing DSH primitives: ${missing.join(", ")}`);
				return;
			}
			ctx.effect(() => ctx.locale.register(namespace, dictionaries), "dsh-skin-market: locale");
			const t = ctx.locale.bind(namespace);
			const clientRuntime = createClientSkinRuntime(ctx.loader);
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "skin-market",
				order: 45,
				label: () => t("nav"),
				locale: namespace,
				inject: () => ({ t })
			}, () => (0, react.createElement)(SkinMarketSection, {
				t,
				clientRuntime
			})));
		}
		//#endregion
		exports.REQUIRED_PRIMITIVES = REQUIRED_PRIMITIVES;
		exports.SkinMarketSection = SkinMarketSection;
		exports.apply = apply;
		exports.createClientSkinRuntime = createClientSkinRuntime;
		exports.inject = inject;
		exports.missingPrimitives = missingPrimitives;
		exports.name = name;
		exports.switchClientSkin = switchClientSkin;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map