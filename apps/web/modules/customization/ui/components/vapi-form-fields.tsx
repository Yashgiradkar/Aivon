import { useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { useVapiAssistants, useVapiPhoneNumbers } from "@/modules/plugins/hooks/use-vapi-data";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Input } from "@workspace/ui/components/input";
import { Button } from "@workspace/ui/components/button";
import { ExternalLinkIcon } from "lucide-react";
import { FormSchema } from "../../types";

interface VapiFormFieldsProps {
  form: UseFormReturn<FormSchema>;
}

export const VapiFormFields = ({ form }: VapiFormFieldsProps) => {
  const { data: assistants, isLoading: assistantsLoading } = useVapiAssistants();
  const { data: phoneNumbers, isLoading: phoneNumbersLoading } = useVapiPhoneNumbers();
  const [manualAssistant, setManualAssistant] = useState(false);

  const disabled = form.formState.isSubmitting;

  return (
    <>
      <FormField
        control={form.control}
        name="vapiSettings.assistantId"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between">
              <FormLabel>Voice Assistant</FormLabel>
              <button
                type="button"
                className="text-xs text-primary underline hover:opacity-80"
                onClick={() => setManualAssistant(!manualAssistant)}
              >
                {manualAssistant ? "Select from list" : "Enter ID manually"}
              </button>
            </div>

            {manualAssistant || (assistants.length === 0 && !assistantsLoading) ? (
              <FormControl>
                <Input
                  {...field}
                  placeholder="e.g. 12345678-abcd-1234-abcd-1234567890ab"
                  disabled={disabled}
                />
              </FormControl>
            ) : (
              <Select
                disabled={assistantsLoading || disabled}
                onValueChange={field.onChange}
                value={field.value || "none"}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        assistantsLoading
                          ? "Loading assistants..."
                          : "Select an assistant"
                      }
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {assistants.map((assistant) => (
                    <SelectItem key={assistant.id} value={assistant.id}>
                      {assistant.name || "Unnamed Assistant"} -{" "}
                      {assistant.model?.model || "Unknown model"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <FormDescription className="flex items-center justify-between text-xs">
              <span>The Vapi assistant to use for voice calls.</span>
              <a
                href="https://dashboard.vapi.ai/assistants"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Vapi Assistants <ExternalLinkIcon className="h-3 w-3" />
              </a>
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="vapiSettings.phoneNumber"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Display Phone Number</FormLabel>
            <Select
              disabled={phoneNumbersLoading || disabled}
              onValueChange={field.onChange}
              value={field.value || "none"}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      phoneNumbersLoading
                        ? "Loading phone numbers..."
                        : "Select a phone number"
                    }
                  />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {phoneNumbers.map((phone) => (
                  <SelectItem key={phone.id} value={phone.number || phone.id}>
                    {phone.number || "Unknown"} - {phone.name || "Unnamed"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormDescription>
              Phone number to display in the widget
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
};