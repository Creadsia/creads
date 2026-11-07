from transformers import Wav2Vec2Config, Wav2Vec2Model
from transformers.modeling_outputs import BaseModelOutput
import torch
import torch.nn.functional as F

# ---------------------------------------------------------------------------
# Creads patch (vs upstream ComfyUI-WanVideoWrapper/multitalk/wav2vec2.py):
# Newer transformers (>= ~4.52 / 5.x, as shipped in the worker base image)
# refactored Wav2Vec2Encoder.forward so that passing output_hidden_states=True
# no longer guarantees encoder_outputs.hidden_states is populated — it can come
# back as None. MultiTalkWav2VecEmbeds then does
#     audio_emb = torch.stack(embeddings.hidden_states[1:], dim=1)
# which crashes with "'NoneType' object is not subscriptable" and produces no
# video. Downgrading transformers is not viable (it drags huggingface_hub down
# and breaks diffusers / the whole WanVideoWrapper import). So instead we capture
# the per-layer hidden states ourselves with forward pre-hooks on the encoder
# layers, which is robust across transformers versions. Everything else matches
# upstream behaviour.
# ---------------------------------------------------------------------------

def get_mask_from_lengths(lengths, max_len=None):
    lengths = lengths.to(torch.long)
    if max_len is None:
        max_len = torch.max(lengths).item()

    ids = torch.arange(0, max_len).unsqueeze(0).expand(lengths.shape[0], -1).to(lengths.device)
    mask = ids < lengths.unsqueeze(1).expand(-1, max_len)

    return mask


def linear_interpolation(features, seq_len):
    features = features.transpose(1, 2)
    output_features = F.interpolate(features, size=seq_len, align_corners=True, mode='linear')
    return output_features.transpose(1, 2)


# the implementation of Wav2Vec2Model is borrowed from
# https://github.com/huggingface/transformers/blob/HEAD/src/transformers/models/wav2vec2/modeling_wav2vec2.py
# initialize our encoder with the pre-trained wav2vec 2.0 weights.
class Wav2Vec2Model(Wav2Vec2Model):
    def __init__(self, config: Wav2Vec2Config):
        super().__init__(config)

    def _encode_collect_hidden_states(self, hidden_states, attention_mask):
        """Run the encoder while collecting every layer's hidden state, independent
        of whether this transformers version honours output_hidden_states.

        Returns (all_hidden_states, last_hidden_state) where all_hidden_states is a
        tuple matching HF's convention: (input_to_layer_0, output_layer_0, ...,
        output_layer_{N-1}); i.e. all_hidden_states[1:] are the per-layer outputs."""
        collected = []
        handles = []
        layers = getattr(self.encoder, "layers", None) or []
        for layer in layers:
            def _pre_hook(module, args, kwargs, _c=collected):
                if args:
                    _c.append(args[0])
                elif "hidden_states" in kwargs:
                    _c.append(kwargs["hidden_states"])
                return None
            try:
                handles.append(layer.register_forward_pre_hook(_pre_hook, with_kwargs=True))
            except TypeError:
                # older torch without with_kwargs
                def _pre_hook_nokw(module, args, _c=collected):
                    if args:
                        _c.append(args[0])
                    return None
                handles.append(layer.register_forward_pre_hook(_pre_hook_nokw))

        try:
            encoder_outputs = self.encoder(hidden_states, attention_mask=attention_mask)
        finally:
            for h in handles:
                h.remove()

        if hasattr(encoder_outputs, "last_hidden_state"):
            last_hidden = encoder_outputs.last_hidden_state
        elif isinstance(encoder_outputs, (tuple, list)):
            last_hidden = encoder_outputs[0]
        else:
            last_hidden = encoder_outputs

        all_hidden_states = tuple(collected) + (last_hidden,)
        return all_hidden_states, last_hidden

    def forward(
        self,
        input_values,
        seq_len,
        attention_mask=None,
        mask_time_indices=None,
        output_attentions=None,
        output_hidden_states=None,
        return_dict=None,
    ):
        extract_features = self.feature_extractor(input_values)
        extract_features = extract_features.transpose(1, 2)
        extract_features = linear_interpolation(extract_features, seq_len=seq_len)

        if attention_mask is not None:
            # compute reduced attention_mask corresponding to feature vectors
            attention_mask = self._get_feature_vector_attention_mask(
                extract_features.shape[1], attention_mask, add_adapter=False
            )

        hidden_states, extract_features = self.feature_projection(extract_features)
        hidden_states = self._mask_hidden_states(
            hidden_states, mask_time_indices=mask_time_indices, attention_mask=attention_mask
        )

        all_hidden_states, last_hidden = self._encode_collect_hidden_states(hidden_states, attention_mask)

        if self.adapter is not None:
            last_hidden = self.adapter(last_hidden)

        return BaseModelOutput(
            last_hidden_state=last_hidden,
            hidden_states=all_hidden_states,
            attentions=None,
        )

    def feature_extract(
        self,
        input_values,
        seq_len,
    ):
        extract_features = self.feature_extractor(input_values)
        extract_features = extract_features.transpose(1, 2)
        extract_features = linear_interpolation(extract_features, seq_len=seq_len)

        return extract_features

    def encode(
        self,
        extract_features,
        attention_mask=None,
        mask_time_indices=None,
        output_attentions=None,
        output_hidden_states=None,
        return_dict=None,
    ):
        if attention_mask is not None:
            # compute reduced attention_mask corresponding to feature vectors
            attention_mask = self._get_feature_vector_attention_mask(
                extract_features.shape[1], attention_mask, add_adapter=False
            )

        hidden_states, extract_features = self.feature_projection(extract_features)
        hidden_states = self._mask_hidden_states(
            hidden_states, mask_time_indices=mask_time_indices, attention_mask=attention_mask
        )

        all_hidden_states, last_hidden = self._encode_collect_hidden_states(hidden_states, attention_mask)

        if self.adapter is not None:
            last_hidden = self.adapter(last_hidden)

        return BaseModelOutput(
            last_hidden_state=last_hidden,
            hidden_states=all_hidden_states,
            attentions=None,
        )
