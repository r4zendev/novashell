// Vendored from gnim-utils by retrozinndev
// https://github.com/retrozinndev/gnim-utils
// Licensed under MIT License

import { Accessor, For, getScope, type Node, With } from "ags";
import GObject from "ags/gobject";

type JSXNode = Node;

function snakeify(str: string): string {
	return str
		.replace(/[A-Z]/g, (s) => `_${s.toLowerCase()}`)
		.replace(/-/g, "_")
		.toLowerCase();
}

function kebabify(str: string): string {
	return str
		.replace(/[A-Z]/g, (s) => `-${s.toLowerCase()}`)
		.replace(/_/g, "-")
		.toLowerCase();
}

/** subscribes to an accessor, with the extra of when
 * the scope is disposed, the subscription is also disposed */
export function createSubscription<T = any>(
	accessor: Accessor<T>,
	callback: () => void,
): void {
	const scope = getScope();
	const sub = accessor.subscribe(callback);

	scope.onCleanup(sub);
}

/** convert a normal value or accessor to a boolean/Accessor<boolean> value.
 * equivalent to Boolean(value), but adds support to Accessor and arrays.
 *
 * @returns false when the value is falsy("", 0, false, undefined, null) or an empty array,
 * if something else, true */
export function toBoolean(
	variable: any | Array<any> | Accessor<Array<any> | any>,
): boolean | Accessor<boolean> {
	return variable instanceof Accessor
		? variable.as((v: Array<any> | any) =>
				Array.isArray(v) ? (v as Array<any>).length > 0 : Boolean(v),
			)
		: Array.isArray(variable)
			? variable.length > 0
			: Boolean(variable);
}

/** checks if gobject has a getter for the specified property */
function hasGetter(gobj: GObject.Object, prop: string): boolean {
	return (
		typeof gobj[`get_${snakeify(prop as string)}` as keyof typeof gobj] ===
			"function" || Object.hasOwn(gobj, prop)
	);
}

/** securely bind to a GObject property. works the same as gnim's createBinding, but
 * allows setting a value to return when things go wrong.
 *
 * @param gobj the gobject to bind a property of
 * @param prop the property to bind
 * @param defaultValue the value to return when something goes wrong
 *
 * @example
 * the gobject is disposed/destroyed, return the default value.
 * the property is removed, return the default value */
export function createSecureBinding<
	GObj extends GObject.Object,
	Prop extends keyof GObj,
	Returns,
>(
	gobj: GObj,
	prop: Prop,
	defaultValue: Returns,
): Accessor<NonNullable<GObj[Prop]> | Returns> {
	const get = () =>
		gobj
			? hasGetter(gobj, prop as string)
				? (
						gobj[
							`get_${snakeify(prop as string)}` as keyof typeof gobj
						] as Function
					)()
				: (gobj[prop] as NonNullable<GObj[Prop]>)
			: defaultValue;

	return new Accessor<NonNullable<GObj[Prop]> | Returns>(
		get,
		(notify: () => void) => {
			const gobjectProp = kebabify(prop as string);
			const id = gobj.connect(`notify::${gobjectProp}`, () => notify());
			return () => {
				try {
					gobj.disconnect(id);
				} catch (e) {}
			};
		},
	);
}

/** securely bind to a property of an existing gobject wrapped with an accessor.
 *
 * It follows the same idea of secureBinding: allows setting
 * a default value to return when the base gobject is null.
 *
 * @param accessor a binding to the constantly updated property
 * that points to the gobject
 * @param prop the property to bind
 * @param defaultValue the value to return when the baseObject is
 * null/undefined
 *
 * @returns a bind to the specified property of the constantly-updated
 * object or the default value.
 * */
export function createSecureAccessorBinding<
	NullableT extends GObject.Object | null | undefined = GObject.Object,
	T extends NonNullable<NullableT> = NonNullable<NullableT>,
	Prop extends keyof T = keyof T,
	Default = any,
>(
	baseObject: Accessor<NullableT>,
	prop: Prop,
	defaultValue: Default,
): Accessor<NonNullable<T[Prop]> | Default> {
	let gobj: NullableT | undefined | null = baseObject.get();
	let notify: () => void;

	const baseSub = baseObject.subscribe(() => {
		const newBase = baseObject.get();

		if (!newBase) {
			gobj = undefined;
			notify!();
			return;
		}

		gobj = newBase;
		notify!();
	});

	const accessor = new Accessor<NonNullable<T[Prop]> | Default>(
		() => (gobj ? ((gobj as T)[prop] as NonNullable<T[Prop]>) : defaultValue),
		(notifyFun: () => void) => {
			notify = notifyFun;

			const id = gobj?.connect(
				`notify::${(prop as string).replace(/[A-Z]/g, (s) => `-${s.toLowerCase()}`)}`,
				() => notify(),
			);

			return () => {
				id && gobj?.disconnect(id);
				baseSub();
			};
		},
	);

	return accessor;
}

/** transform data or accessor containing data to widget(s)
 * if an array is provided, the callback will act like a forEach function.
 *
 * @returns the baked widgets */
export function transformWidget<ValueType = unknown>(
	v: Accessor<ValueType | Array<ValueType>> | ValueType | Array<ValueType>,
	fn: (v: ValueType, i?: Accessor<number> | number) => JSX.Element,
): JSXNode {
	return v instanceof Accessor
		? Array.isArray(v.get())
			? For({
					each: v as Accessor<Array<ValueType>>,
					children: (cval: ValueType, i: Accessor<number>) => fn(cval, i),
				})
			: With({
					value: v as Accessor<ValueType>,
					children: fn,
				})
		: Array.isArray(v)
			? v.map((val) => fn(val))
			: fn(v);
}

/** initialize class fields with a props object and dispose subscriptions together with
 * the current scope.
 * class fields need to have the same name as in the property object to make this work.
 *
 * this should be used when the class constructor contains props that are
 * defined as accessors and normal values together.
 *
 * it's not recommended to use this method, instead, you can subclass widgets and use
 * property decorators and JSX syntax, which allows you to use accessors as property
 * values without explicitly allowing them to be accessors.
 *
 * @param klass the class to apply the field values to
 * @param props the props object containing the keys and their values
 *
 * @returns an array containing all the subscriptions */
export function construct<Class extends object>(
	klass: Class,
	props: Record<string | number | symbol, any | Accessor<any>>,
): Array<() => void> {
	const subs: Array<() => void> = [];
	const isGObject = klass instanceof GObject.Object;

	Object.keys(props).forEach((k) => {
		const v = props[k as keyof typeof props];

		if (v === undefined) return;
		if (v instanceof Accessor) {
			subs.push(
				v.subscribe(() => {
					klass[k as keyof Class] = v.get() as Class[keyof Class];
					if (isGObject)
						(klass as unknown as GObject.Object).notify(
							k.replace(/[A-Z]/g, (s) => `-${s.toLowerCase()}`),
						);
				}),
			);

			klass[k as keyof Class] = v.get() as Class[keyof Class];
			return;
		}

		klass[k as keyof Class] = v as Class[keyof Class];
	});

	return subs;
}

/** works the same as connecting to a signal of the gobject, but
 * it's disposed as soon as the current scope is disposed. */
export function createScopedConnection<
	GObj extends GObject.Object,
	Signal extends keyof GObj["$signals"],
>(gobj: GObj, signal: Signal, callback: GObj["$signals"][Signal]): void {
	const scope = getScope();
	const id = gobj.connect(
		signal as string,
		(_: unknown, ...args: Array<unknown>) => (callback as Function)(...args),
	);

	scope.onCleanup(() => gobj.disconnect(id));
}
