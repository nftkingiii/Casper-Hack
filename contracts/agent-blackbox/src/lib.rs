#![no_std]
#![no_main]
#![allow(internal_features)]
#![feature(alloc_error_handler, core_intrinsics, lang_items)]

extern crate alloc;

use alloc::{string::String, vec};
use casper_contract::{
    contract_api::{runtime, storage},
    unwrap_or_revert::UnwrapOrRevert,
};
use casper_types::{
    contracts::{EntryPoint, EntryPoints, NamedKeys},
    CLType, EntryPointAccess, EntryPointType, Key, Parameter, URef,
};

#[global_allocator]
static ALLOC: dlmalloc::GlobalDlmalloc = dlmalloc::GlobalDlmalloc;

const RECEIPTS: &str = "receipts";
const RECEIPT_COUNT: &str = "receipt_count";
const CONTRACT_PACKAGE_HASH: &str = "agent_blackbox_package_hash";
const CONTRACT_ACCESS_UREF: &str = "agent_blackbox_access_uref";

#[no_mangle]
pub extern "C" fn submit_receipt() {
    let receipt_id: String = runtime::get_named_arg("receipt_id");
    let receipt_hash: String = runtime::get_named_arg("receipt_hash");
    let agent_id: String = runtime::get_named_arg("agent_id");
    let policy_hash: String = runtime::get_named_arg("policy_hash");
    let cost_motes: String = runtime::get_named_arg("cost_motes");
    let tool: String = runtime::get_named_arg("tool");
    let decision: String = runtime::get_named_arg("decision");
    let timestamp: String = runtime::get_named_arg("timestamp");
    let dictionary_uref = get_receipts_uref();
    let record = alloc::format!(
        "{}|{}|{}|{}|{}|{}|{}",
        receipt_hash, agent_id, policy_hash, cost_motes, tool, decision, timestamp
    );
    storage::dictionary_put(dictionary_uref, &receipt_id, record);
    increment_receipt_count();
}

#[no_mangle]
pub extern "C" fn call() {
    let mut entry_points = EntryPoints::new();
    entry_points.add_entry_point(EntryPoint::new(
        "submit_receipt",
        vec![
            Parameter::new("receipt_id", CLType::String),
            Parameter::new("receipt_hash", CLType::String),
            Parameter::new("agent_id", CLType::String),
            Parameter::new("policy_hash", CLType::String),
            Parameter::new("cost_motes", CLType::String),
            Parameter::new("tool", CLType::String),
            Parameter::new("decision", CLType::String),
            Parameter::new("timestamp", CLType::String),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));
    let receipts = storage::new_dictionary(RECEIPTS).unwrap_or_revert();
    let receipt_count = storage::new_uref(0_u64);
    let mut named_keys = NamedKeys::new();
    named_keys.insert(RECEIPTS.into(), Key::URef(receipts));
    named_keys.insert(RECEIPT_COUNT.into(), Key::URef(receipt_count));
    let (contract_hash, _version) = storage::new_contract(
        entry_points.into(),
        Some(named_keys),
        Some(CONTRACT_PACKAGE_HASH.into()),
        Some(CONTRACT_ACCESS_UREF.into()),
        None,
    );
    runtime::put_key("agent_blackbox_contract", contract_hash.into());
}

fn get_receipts_uref() -> URef {
    runtime::get_key(RECEIPTS)
        .and_then(Key::into_uref)
        .unwrap_or_revert()
}

fn increment_receipt_count() {
    let count_uref = runtime::get_key(RECEIPT_COUNT)
        .and_then(Key::into_uref)
        .unwrap_or_revert();
    let current: u64 = storage::read(count_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    storage::write(count_uref, current + 1);
}

#[panic_handler]
pub fn panic(_info: &core::panic::PanicInfo) -> ! {
    core::intrinsics::abort();
}

#[alloc_error_handler]
pub fn oom(_: core::alloc::Layout) -> ! {
    core::intrinsics::abort();
}

#[lang = "eh_personality"]
extern "C" fn eh_personality() {}
